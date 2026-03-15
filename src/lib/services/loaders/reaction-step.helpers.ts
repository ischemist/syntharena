/**
 * Shared helper for upserting ReactionStep records during route loading.
 * Used by both the prediction loader and benchmark loader.
 */
import type { Prisma } from '@prisma/client'

import type prisma from '@/lib/db'

/** Minimal DB client interface — works with both PrismaClient and TransactionClient. */
type DbClient = typeof prisma | Prisma.TransactionClient

/** Shape of a node that carries reaction data for ReactionStep upsert. */
interface NodeWithReactionData {
    reactionHash: string | null
    template: string | null
    metadata: string | null
}

/**
 * Upserts ReactionStep records for a batch of route nodes.
 * Finds existing steps by reactionHash and creates missing ones.
 *
 * @returns Map from reactionHash to ReactionStep.id
 */
export async function upsertReactionSteps(nodes: NodeWithReactionData[], db: DbClient): Promise<Map<string, string>> {
    // Collect unique reactions by reactionHash
    const reactionHashToData = new Map<string, { template: string | null; metadata: string | null }>()
    for (const node of nodes) {
        if (node.reactionHash && !reactionHashToData.has(node.reactionHash)) {
            reactionHashToData.set(node.reactionHash, {
                template: node.template,
                metadata: node.metadata,
            })
        }
    }

    const reactionHashToId = new Map<string, string>()
    const reactionHashes = Array.from(reactionHashToData.keys())

    if (reactionHashes.length === 0) return reactionHashToId

    // Find existing ReactionStep records
    const existingSteps = await db.reactionStep.findMany({
        where: { reactionHash: { in: reactionHashes } },
        select: { id: true, reactionHash: true },
    })
    for (const step of existingSteps) {
        reactionHashToId.set(step.reactionHash, step.id)
    }

    // Create missing ReactionStep records
    for (const [hash, data] of reactionHashToData) {
        if (!reactionHashToId.has(hash)) {
            const created = await db.reactionStep.create({
                data: { reactionHash: hash, template: data.template, metadata: data.metadata },
                select: { id: true },
            })
            reactionHashToId.set(hash, created.id)
        }
    }

    return reactionHashToId
}
