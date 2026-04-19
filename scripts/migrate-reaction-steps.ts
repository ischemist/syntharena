#!/usr/bin/env tsx

/**
 * Data migration: Populate ReactionStep table and backfill RouteNode.reactionStepId.
 *
 * This script:
 * 1. Recomputes reactionHash using InChIKeys (not SMILES) for all non-leaf RouteNodes
 * 2. Extracts unique (reactionHash, template, metadata) into ReactionStep records
 * 3. Sets RouteNode.reactionStepId to point to the corresponding ReactionStep
 *
 * Uses raw better-sqlite3 for performance (~3M rows).
 * Idempotent: safe to re-run if interrupted.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-reaction-steps.ts
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import { createId } from '@paralleldrive/cuid2'
import Database from 'better-sqlite3'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DB_PATH = 'prisma/dev.db'
const BATCH_SIZE = 50_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeReactionHash(productInchikey: string, reactantInchikeys: string[]): string {
    const sorted = [...reactantInchikeys].sort()
    const content = `${productInchikey}>>${sorted.join('.')}`
    return crypto.createHash('sha256').update(content).digest('hex')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
    // Create backup before migration
    const backupPath = DB_PATH + '.backup-before-reaction-step'
    if (!fs.existsSync(backupPath)) {
        console.log(`Backing up database to ${backupPath}...`)
        fs.copyFileSync(DB_PATH, backupPath)
    } else {
        console.log(`Backup already exists at ${backupPath}, skipping.`)
    }

    const db = new Database(DB_PATH)
    try {
        // Performance pragmas
        db.pragma('journal_mode = WAL')
        db.pragma('synchronous = NORMAL')
        db.pragma('foreign_keys = OFF') // Re-enabled before verification step

        console.log('\n=== ReactionStep Data Migration ===\n')

        // -----------------------------------------------------------------------
        // Step 0: Check current state
        // -----------------------------------------------------------------------

        const totalNodes = (db.prepare('SELECT COUNT(*) as cnt FROM RouteNode').get() as { cnt: number }).cnt
        const nonLeafNodes = (
            db.prepare('SELECT COUNT(*) as cnt FROM RouteNode WHERE isLeaf = 0').get() as { cnt: number }
        ).cnt
        const alreadyLinked = (
            db.prepare('SELECT COUNT(*) as cnt FROM RouteNode WHERE reactionStepId IS NOT NULL').get() as {
                cnt: number
            }
        ).cnt
        const existingSteps = (db.prepare('SELECT COUNT(*) as cnt FROM ReactionStep').get() as { cnt: number }).cnt

        console.log(`Total RouteNodes:       ${totalNodes.toLocaleString()}`)
        console.log(`Non-leaf RouteNodes:    ${nonLeafNodes.toLocaleString()}`)
        console.log(`Already linked:         ${alreadyLinked.toLocaleString()}`)
        console.log(`Existing ReactionSteps: ${existingSteps.toLocaleString()}`)
        console.log()

        if (alreadyLinked === nonLeafNodes && existingSteps > 0) {
            console.log('Migration appears complete. All non-leaf nodes already linked.')
            console.log('To re-run, clear reactionStepId and ReactionStep table first.')
            return
        }

        const startTime = Date.now()

        // -----------------------------------------------------------------------
        // Step 1: Build in-memory lookup of parent → children inchikeys
        //
        // Strategy: instead of querying children per-node (1.5M queries = slow),
        // do TWO bulk queries and join in memory.
        // -----------------------------------------------------------------------

        console.log('Step 1a: Loading node → inchikey mapping...')

        // Map: nodeId → inchikey (for ALL nodes, ~3M entries)
        const nodeInchikey = new Map<string, string>()
        const nodeInchikeyQuery = db.prepare(`
            SELECT rn.id, m.inchikey
            FROM RouteNode rn
            JOIN Molecule m ON rn.moleculeId = m.id
        `)

        let count = 0
        for (const row of nodeInchikeyQuery.iterate() as Iterable<{ id: string; inchikey: string }>) {
            nodeInchikey.set(row.id, row.inchikey)
            count++
            if (count % 500_000 === 0) {
                console.log(`  Loaded ${count.toLocaleString()} node→inchikey mappings`)
            }
        }
        console.log(
            `  Done: ${count.toLocaleString()} mappings loaded (${((Date.now() - startTime) / 1000).toFixed(1)}s)`
        )

        console.log('\nStep 1b: Loading parent → children relationships...')

        // Map: parentId → [child inchikeys]
        const parentChildren = new Map<string, string[]>()
        const childQuery = db.prepare(`
            SELECT parentId, id as childId
            FROM RouteNode
            WHERE parentId IS NOT NULL
        `)

        count = 0
        for (const row of childQuery.iterate() as Iterable<{ parentId: string; childId: string }>) {
            const childInchikey = nodeInchikey.get(row.childId)
            if (!childInchikey) continue

            let children = parentChildren.get(row.parentId)
            if (!children) {
                children = []
                parentChildren.set(row.parentId, children)
            }
            children.push(childInchikey)
            count++
            if (count % 500_000 === 0) {
                console.log(`  Loaded ${count.toLocaleString()} child relationships`)
            }
        }
        console.log(
            `  Done: ${count.toLocaleString()} relationships loaded (${((Date.now() - startTime) / 1000).toFixed(1)}s)`
        )

        console.log('\nStep 1c: Loading non-leaf node metadata...')

        // Load template + metadata for non-leaf nodes that still need migration
        const nonLeafMetaQuery = db.prepare(`
            SELECT id, template, metadata
            FROM RouteNode
            WHERE isLeaf = 0
              AND reactionStepId IS NULL
        `)

        interface NodeMeta {
            id: string
            template: string | null
            metadata: string | null
        }

        const nonLeafMeta = new Map<string, NodeMeta>()
        for (const row of nonLeafMetaQuery.iterate() as Iterable<NodeMeta>) {
            nonLeafMeta.set(row.id, row)
        }
        console.log(
            `  Done: ${nonLeafMeta.size.toLocaleString()} non-leaf nodes to process (${((Date.now() - startTime) / 1000).toFixed(1)}s)`
        )

        // -----------------------------------------------------------------------
        // Step 1d: Compute reactionHash for each non-leaf node
        // -----------------------------------------------------------------------

        console.log('\nStep 1d: Computing InChIKey-based reactionHash...')

        interface NodeReaction {
            nodeId: string
            reactionHash: string
            template: string | null
            metadata: string | null
        }

        const nodeReactions: NodeReaction[] = []
        const reactionStepMap = new Map<string, { template: string | null; metadata: string | null }>()

        let processed = 0
        let skippedNoChildren = 0

        for (const [nodeId, meta] of nonLeafMeta) {
            const productInchikey = nodeInchikey.get(nodeId)
            if (!productInchikey) continue

            const reactantInchikeys = parentChildren.get(nodeId)
            if (!reactantInchikeys || reactantInchikeys.length === 0) {
                skippedNoChildren++
                continue
            }

            const hash = computeReactionHash(productInchikey, reactantInchikeys)

            nodeReactions.push({
                nodeId,
                reactionHash: hash,
                template: meta.template,
                metadata: meta.metadata,
            })

            // Store template/metadata for the first occurrence of each unique reaction
            if (!reactionStepMap.has(hash)) {
                reactionStepMap.set(hash, {
                    template: meta.template,
                    metadata: meta.metadata,
                })
            }

            processed++
            if (processed % 250_000 === 0) {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
                console.log(`  Computed ${processed.toLocaleString()} hashes (${elapsed}s)`)
            }
        }

        // Free memory from bulk lookups
        nodeInchikey.clear()
        parentChildren.clear()
        nonLeafMeta.clear()

        const step1Elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        console.log(
            `  Done: ${processed.toLocaleString()} nodes -> ${reactionStepMap.size.toLocaleString()} unique reactions (${step1Elapsed}s)`
        )
        if (skippedNoChildren > 0) {
            console.log(`  Skipped ${skippedNoChildren} non-leaf nodes with no children (data integrity issue)`)
        }

        // -----------------------------------------------------------------------
        // Step 2: Insert unique ReactionStep records
        // -----------------------------------------------------------------------

        console.log('\nStep 2: Inserting ReactionStep records...')

        const insertStep = db.prepare(`
            INSERT OR IGNORE INTO ReactionStep (id, reactionHash, template, metadata)
            VALUES (?, ?, ?, ?)
        `)

        // Build hash -> id map (check existing first)
        const hashToId = new Map<string, string>()

        // Load any existing ReactionStep records (for idempotency)
        const existingStepsRows = db.prepare('SELECT id, reactionHash FROM ReactionStep').all() as {
            id: string
            reactionHash: string
        }[]
        for (const row of existingStepsRows) {
            hashToId.set(row.reactionHash, row.id)
        }
        if (existingStepsRows.length > 0) {
            console.log(`  Found ${existingStepsRows.length.toLocaleString()} existing ReactionStep records`)
        }

        // Insert new ones in batched transactions
        let insertedCount = 0
        const insertTransaction = db.transaction(
            (entries: [string, { template: string | null; metadata: string | null }][]) => {
                for (const [hash, data] of entries) {
                    if (hashToId.has(hash)) continue

                    const id = createId()
                    insertStep.run(id, hash, data.template, data.metadata)
                    hashToId.set(hash, id)
                    insertedCount++
                }
            }
        )

        const entries = Array.from(reactionStepMap.entries())
        for (let i = 0; i < entries.length; i += BATCH_SIZE) {
            const batch = entries.slice(i, i + BATCH_SIZE)
            insertTransaction(batch)
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
            console.log(
                `  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${Math.min(i + BATCH_SIZE, entries.length).toLocaleString()} / ${entries.length.toLocaleString()} (${elapsed}s)`
            )
        }

        console.log(`  Done: ${insertedCount.toLocaleString()} new ReactionStep records inserted`)

        // Free memory
        reactionStepMap.clear()

        // -----------------------------------------------------------------------
        // Step 3: Update RouteNode.reactionStepId
        // -----------------------------------------------------------------------

        console.log('\nStep 3: Updating RouteNode.reactionStepId...')

        const updateNode = db.prepare(`
            UPDATE RouteNode SET reactionStepId = ? WHERE id = ?
        `)

        let updatedCount = 0
        const updateStartTime = Date.now()

        const updateTransaction = db.transaction((batch: NodeReaction[]) => {
            for (const nr of batch) {
                const stepId = hashToId.get(nr.reactionHash)
                if (!stepId) {
                    console.error(`  ERROR: No ReactionStep found for hash ${nr.reactionHash} (node ${nr.nodeId})`)
                    continue
                }
                updateNode.run(stepId, nr.nodeId)
                updatedCount++
            }
        })

        for (let i = 0; i < nodeReactions.length; i += BATCH_SIZE) {
            const batch = nodeReactions.slice(i, i + BATCH_SIZE)
            updateTransaction(batch)
            const elapsed = ((Date.now() - updateStartTime) / 1000).toFixed(1)
            console.log(
                `  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${Math.min(i + BATCH_SIZE, nodeReactions.length).toLocaleString()} / ${nodeReactions.length.toLocaleString()} (${elapsed}s)`
            )
        }

        const step3Elapsed = ((Date.now() - updateStartTime) / 1000).toFixed(1)
        console.log(`  Done: ${updatedCount.toLocaleString()} RouteNodes updated (${step3Elapsed}s)`)

        // -----------------------------------------------------------------------
        // Step 4: Verify
        // -----------------------------------------------------------------------

        // Re-enable foreign key enforcement before verification
        db.pragma('foreign_keys = ON')

        console.log('\nStep 4: Verification...')

        const finalSteps = (db.prepare('SELECT COUNT(*) as cnt FROM ReactionStep').get() as { cnt: number }).cnt
        const finalLinked = (
            db.prepare('SELECT COUNT(*) as cnt FROM RouteNode WHERE reactionStepId IS NOT NULL').get() as {
                cnt: number
            }
        ).cnt
        const unlinkedNonLeaf = (
            db.prepare('SELECT COUNT(*) as cnt FROM RouteNode WHERE isLeaf = 0 AND reactionStepId IS NULL').get() as {
                cnt: number
            }
        ).cnt
        const leafWithStep = (
            db
                .prepare('SELECT COUNT(*) as cnt FROM RouteNode WHERE isLeaf = 1 AND reactionStepId IS NOT NULL')
                .get() as {
                cnt: number
            }
        ).cnt

        console.log(`  ReactionStep records:         ${finalSteps.toLocaleString()}`)
        console.log(`  RouteNodes with reactionStep: ${finalLinked.toLocaleString()}`)
        console.log(`  Unlinked non-leaf nodes:      ${unlinkedNonLeaf.toLocaleString()}`)
        console.log(`  Leaf nodes with step (bug?):  ${leafWithStep.toLocaleString()}`)

        if (unlinkedNonLeaf > 0) {
            console.log(
                '\n  WARNING: Some non-leaf nodes were not linked. These may be nodes with no children (data integrity issue).'
            )
            const examples = db
                .prepare(
                    `SELECT rn.id, rn.routeId, m.smiles
                     FROM RouteNode rn
                     JOIN Molecule m ON rn.moleculeId = m.id
                     WHERE rn.isLeaf = 0 AND rn.reactionStepId IS NULL
                     LIMIT 5`
                )
                .all() as { id: string; routeId: string; smiles: string }[]
            for (const ex of examples) {
                console.log(`    Node ${ex.id} (route ${ex.routeId}): ${ex.smiles}`)
            }
        }

        // Deduplication stats
        const dedupRatio = finalSteps > 0 ? nonLeafNodes / finalSteps : 0
        console.log(
            `\n  Deduplication ratio: ${dedupRatio.toFixed(1)}x (${nonLeafNodes.toLocaleString()} non-leaf nodes -> ${finalSteps.toLocaleString()} unique ReactionSteps)`
        )

        const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        console.log(`\n=== Migration complete in ${totalElapsed}s ===`)
    } finally {
        db.close()
    }
}

main()
