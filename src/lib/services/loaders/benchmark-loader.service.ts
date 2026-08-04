import crypto from 'crypto'
import * as fs from 'fs'
import * as zlib from 'zlib'
import { hashJson, projectRetrocastRoute } from '@ischemist/routes'
import type { RetrocastMolecule, RetrocastReaction, RetrocastRoute } from '@ischemist/routes'
import { Prisma } from '@prisma/client'

import type { LoadBenchmarkResult } from '@/types'
import prisma from '@/lib/db'
import { upsertReactionSteps } from '@/lib/services/loaders/reaction-step.helpers'

// ============================================================================
// Types for internal use (from Python retrocast models)
// ============================================================================

interface PythonMolecule {
    smiles: string
    inchikey: string
    product_of?: PythonReactionStep | null
    annotations?: Record<string, unknown>
    is_leaf?: boolean
}

interface PythonReactionStep {
    reactants: PythonMolecule[]
    mapped_reaction_smiles?: string | null
    template?: string | null
    reagents?: string[] | null
    solvents?: string[] | null
    annotations?: Record<string, unknown>
    is_convergent?: boolean
}

interface PythonRoute {
    target: PythonMolecule
    rank?: number
    length?: number
    has_convergent_reaction?: boolean
    solvability?: Record<string, boolean>
    annotations?: Record<string, unknown>
    schema_version?: string
}

export interface PythonBenchmarkTarget {
    id: string
    smiles: string
    inchikey: string
    annotations?: Record<string, unknown>
    acceptable_routes: PythonRoute[] // Array of acceptable routes (empty = pure prediction task)
}

export interface PythonBenchmarkSet {
    name: string
    description?: string
    stock_name?: string | null
    default_constraints: Array<Record<string, unknown>>
    constraints: Record<string, Array<Record<string, unknown>>>
    targets: Record<string, PythonBenchmarkTarget>
}

// ============================================================================
// Benchmark Loading Functions
// ============================================================================

/**
 * Parses a gzipped JSON benchmark file.
 * Decompresses and parses the JSON in a single stream.
 *
 * @param filePath - Path to .json.gz file
 * @returns Parsed benchmark data
 */
async function parseBenchmarkFile(filePath: string): Promise<PythonBenchmarkSet> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = []

        fs.createReadStream(filePath)
            .pipe(zlib.createGunzip())
            .on('data', (chunk) => {
                chunks.push(chunk)
            })
            .on('end', () => {
                try {
                    const json = Buffer.concat(chunks).toString('utf-8')
                    const data = JSON.parse(json) as PythonBenchmarkSet
                    resolve(data)
                } catch (error) {
                    reject(new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`))
                }
            })
            .on('error', (error) => {
                reject(
                    new Error(`Failed to decompress file: ${error instanceof Error ? error.message : String(error)}`)
                )
            })
    })
}

/**
 * Computes reaction hash for a synthesis step using InChIKeys.
 * Used to detect and deduplicate identical reactions across routes.
 * Aligns with Python retrocast's ReactionSignature convention.
 */
function computeReactionHash(step: PythonReactionStep, productInchikey: string): string {
    const reactantInchikeys = step.reactants.map((r) => r.inchikey).sort()
    const content = `${productInchikey}>>${reactantInchikeys.join('.')}`
    return crypto.createHash('sha256').update(content).digest('hex')
}

function getProductOf(molecule: PythonMolecule): PythonReactionStep | null {
    return molecule.product_of ?? null
}

function getAnnotations(value: { annotations?: Record<string, unknown> }): Record<string, unknown> {
    return value.annotations ?? {}
}

function normalizeMoleculeForRetrocast(molecule: PythonMolecule): RetrocastMolecule {
    const step = getProductOf(molecule)
    return {
        smiles: molecule.smiles,
        inchikey: molecule.inchikey,
        ...(step ? { product_of: normalizeReactionForRetrocast(step) } : {}),
        annotations: getAnnotations(molecule),
    }
}

function normalizeReactionForRetrocast(step: PythonReactionStep): RetrocastReaction {
    return {
        reactants: step.reactants.map(normalizeMoleculeForRetrocast),
        mapped_reaction_smiles: step.mapped_reaction_smiles ?? null,
        template: step.template ?? null,
        reagents: step.reagents ?? null,
        solvents: step.solvents ?? null,
        annotations: getAnnotations(step),
    }
}

function normalizeRouteForRetrocast(route: PythonRoute): RetrocastRoute {
    return {
        target: normalizeMoleculeForRetrocast(route.target),
        annotations: getAnnotations(route),
        schema_version: '2',
    }
}

function routeProjection(route: PythonRoute) {
    return projectRetrocastRoute(normalizeRouteForRetrocast(route))
}

/**
 * Internal structure for building route nodes in memory before bulk insert.
 * Reaction topology is deduplicated through reactionHash. Exact producer SMILES,
 * templates, and metadata remain on each RouteNode occurrence.
 */
interface RouteNodeToCreate {
    tempId: string // Temporary ID for tracking parent-child relationships
    routeId: string
    moleculeInchikey: string
    parentTempId: string | null
    isLeaf: boolean
    reactionHash: string | null // Used for ReactionStep topology dedup
    template: string | null
    metadata: string | null
    smiles: string
}

/**
 * Recursively collects all molecules and nodes from a route tree in memory.
 *
 * @param molecule - Current molecule in the tree
 * @param routeId - The route ID
 * @param parentTempId - Parent's temporary ID
 * @param molecules - Map to collect unique molecules
 * @param nodes - Array to collect all nodes
 * @returns Temporary ID of the created node
 */
function collectRouteTreeData(
    molecule: PythonMolecule,
    routeId: string,
    parentTempId: string | null,
    molecules: Map<string, { smiles: string; inchikey: string }>,
    nodes: RouteNodeToCreate[],
    tempIdCounter: { value: number }
): string {
    // Add molecule to collection if not already present
    if (!molecules.has(molecule.inchikey)) {
        molecules.set(molecule.inchikey, {
            smiles: molecule.smiles,
            inchikey: molecule.inchikey,
        })
    }

    // Generate temporary ID for this node
    const tempId = `temp-${tempIdCounter.value++}`

    // Create node data
    const step = getProductOf(molecule)
    const isLeaf = !step || molecule.is_leaf === true
    const reactionHash = step ? computeReactionHash(step, molecule.inchikey) : null

    // Prepare node metadata (reagents, solvents, mapped_reaction_smiles)
    // Aligned with prediction-loader to ensure consistent ReactionStep.metadata format
    let metadata: string | null = null
    if (step) {
        const metadataObj: Record<string, unknown> = {}
        if (step.reagents) metadataObj.reagents = step.reagents
        if (step.solvents) metadataObj.solvents = step.solvents
        if (step.mapped_reaction_smiles) metadataObj.mapped_reaction_smiles = step.mapped_reaction_smiles
        const stepAnnotations = getAnnotations(step)
        if (Object.keys(stepAnnotations).length > 0) metadataObj.annotations = stepAnnotations
        if (Object.keys(metadataObj).length > 0) {
            metadata = JSON.stringify(metadataObj)
        }
    }

    const node: RouteNodeToCreate = {
        tempId,
        routeId,
        moleculeInchikey: molecule.inchikey,
        parentTempId,
        isLeaf,
        reactionHash,
        template: step?.template || null,
        metadata,
        smiles: molecule.smiles,
    }
    nodes.push(node)

    // Recursively process reactants
    if (step?.reactants) {
        for (const reactant of step.reactants) {
            collectRouteTreeData(reactant, routeId, tempId, molecules, nodes, tempIdCounter)
        }
    }

    return tempId
}

/**
 * Stores a route tree in the database using bulk operations.
 * Minimizes database queries by collecting all data in memory first,
 * then performing bulk inserts.
 *
 * @param routeId - The route ID
 * @param rootMolecule - Root molecule (target)
 * @param tx - Transaction client
 * @returns Number of new molecules created
 */
async function storeRouteTree(
    routeId: string,
    rootMolecule: PythonMolecule,
    tx: Prisma.TransactionClient
): Promise<number> {
    // Step 1: Collect all unique molecules and nodes in memory
    const moleculesMap = new Map<string, { smiles: string; inchikey: string }>()
    const nodesData: RouteNodeToCreate[] = []
    const tempIdCounter = { value: 0 }

    collectRouteTreeData(rootMolecule, routeId, null, moleculesMap, nodesData, tempIdCounter)

    // Step 2: Bulk handle molecules
    const uniqueInchikeys = Array.from(moleculesMap.keys())

    // Find existing molecules
    const existingMolecules = await tx.molecule.findMany({
        where: { inchikey: { in: uniqueInchikeys } },
        select: { id: true, inchikey: true },
    })

    const existingInchikeyToId = new Map(existingMolecules.map((m) => [m.inchikey, m.id]))

    // Create new molecules
    const newMolecules = Array.from(moleculesMap.values()).filter((m) => !existingInchikeyToId.has(m.inchikey))

    let moleculesCreated = 0
    if (newMolecules.length > 0) {
        // SQLite doesn't support skipDuplicates in createMany, so we use individual creates
        // This is still much faster than the original recursive approach
        const createdMolecules = await Promise.all(
            newMolecules.map((m) =>
                tx.molecule.create({
                    data: m,
                    select: { id: true, inchikey: true },
                })
            )
        )
        moleculesCreated = createdMolecules.length

        for (const mol of createdMolecules) {
            existingInchikeyToId.set(mol.inchikey, mol.id)
        }
    }

    // Step 3: Upsert ReactionStep records for non-leaf nodes
    const reactionHashToId = await upsertReactionSteps(nodesData, tx)

    // Step 4: Create all nodes with proper parent-child relationships
    const tempIdToRealId = new Map<string, string>()

    const nodesByParent = new Map<string | null, RouteNodeToCreate[]>()
    for (const node of nodesData) {
        const parentKey = node.parentTempId
        if (!nodesByParent.has(parentKey)) {
            nodesByParent.set(parentKey, [])
        }
        nodesByParent.get(parentKey)!.push(node)
    }

    // Breadth-first creation to ensure parents are created before children
    const queue: RouteNodeToCreate[] = nodesByParent.get(null) || []
    while (queue.length > 0) {
        const currentBatch = [...queue]
        queue.length = 0

        // Create current batch
        for (const nodeData of currentBatch) {
            const moleculeId = existingInchikeyToId.get(nodeData.moleculeInchikey)
            if (!moleculeId) {
                throw new Error(`Molecule not found for inchikey: ${nodeData.moleculeInchikey}`)
            }

            const parentId = nodeData.parentTempId ? tempIdToRealId.get(nodeData.parentTempId) || null : null
            const reactionStepId = nodeData.reactionHash ? (reactionHashToId.get(nodeData.reactionHash) ?? null) : null

            const createdNode = await tx.routeNode.create({
                data: {
                    routeId: nodeData.routeId,
                    moleculeId,
                    smiles: nodeData.smiles,
                    parentId,
                    isLeaf: nodeData.isLeaf,
                    reactionStepId,
                    template: nodeData.template,
                    metadata: nodeData.metadata,
                },
                select: { id: true },
            })

            tempIdToRealId.set(nodeData.tempId, createdNode.id)

            // Add children to queue
            const children = nodesByParent.get(nodeData.tempId) || []
            queue.push(...children)
        }
    }

    return moleculesCreated
}

/**
 * Loads a benchmark from a JSON.gz file.
 * Parses targets, creates molecules, benchmark targets, and routes.
 *
 * @param filePath - Path to benchmark .json.gz file
 * @param benchmarkName - Name for the benchmark
 * @param benchmarkId - ID of the benchmark to load into
 * @param description - Optional description
 * @returns Load statistics
 * @throws Error if file not found, invalid format, or database errors
 */
export async function loadBenchmarkFromFile(
    filePath: string,
    benchmarkId: string,
    benchmarkName: string
): Promise<LoadBenchmarkResult> {
    // Validate file exists
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`)
    }

    // Parse benchmark file
    if (process.env.NODE_ENV !== 'test') {
        console.log('Parsing benchmark file...')
    }
    const benchmarkData = await parseBenchmarkFile(filePath)

    return loadBenchmarkData(benchmarkData, benchmarkId, benchmarkName)
}

/**
 * Loads a benchmark definition already parsed from caller-owned bytes. Corpus
 * rebuilds use this boundary to bind source verification and persistence to the
 * same captured artifact rather than reopening a mutable path.
 */
export async function loadBenchmarkData(
    benchmarkData: PythonBenchmarkSet,
    benchmarkId: string,
    benchmarkName: string
): Promise<LoadBenchmarkResult> {
    if (!Array.isArray(benchmarkData.default_constraints)) {
        throw new Error(`Benchmark ${benchmarkName} has invalid default_constraints`)
    }
    if (
        !benchmarkData.constraints ||
        typeof benchmarkData.constraints !== 'object' ||
        Array.isArray(benchmarkData.constraints)
    ) {
        throw new Error(`Benchmark ${benchmarkName} has invalid constraints`)
    }
    await prisma.benchmarkSet.update({
        where: { id: benchmarkId },
        data: {
            defaultConstraintsJson: JSON.stringify(benchmarkData.default_constraints),
            targetConstraintsJson: JSON.stringify(benchmarkData.constraints),
        },
    })

    // Load targets
    const targetIds = Object.keys(benchmarkData.targets)
    if (process.env.NODE_ENV !== 'test') {
        console.log(`Loading ${targetIds.length} targets...`)
    }

    let moleculesCreated = 0
    let moleculesReused = 0
    let routesCreated = 0
    let acceptableRoutesCreated = 0

    const BATCH_SIZE = 10 // Conservative batch size for route parsing

    for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
        const batch = targetIds.slice(i, i + BATCH_SIZE)

        await prisma.$transaction(async (tx) => {
            for (const externalId of batch) {
                const targetData = benchmarkData.targets[externalId]

                // Get or create target molecule
                const targetInchikey = targetData.inchikey

                if (!targetInchikey) {
                    throw new Error(`Target ${externalId} is missing inchikey`)
                }

                let targetMol = await tx.molecule.findUnique({
                    where: { inchikey: targetInchikey },
                    select: { id: true },
                })

                if (!targetMol) {
                    targetMol = await tx.molecule.create({
                        data: {
                            smiles: targetData.smiles,
                            inchikey: targetInchikey,
                        },
                        select: { id: true },
                    })
                    moleculesCreated++
                } else {
                    moleculesReused++
                }

                // Compute routeLength and isConvergent from PRIMARY acceptable route (index 0)
                let routeLength: number | null = null
                let isConvergent: boolean | null = null
                const acceptableRoutes = targetData.acceptable_routes
                if (acceptableRoutes && acceptableRoutes.length > 0) {
                    const primaryRoute = acceptableRoutes[0]
                    const primaryProjection = routeProjection(primaryRoute)
                    routeLength = primaryRoute.length ?? primaryProjection.route.length
                    isConvergent = primaryRoute.has_convergent_reaction ?? primaryProjection.route.hasConvergentReaction
                }

                // Create benchmark target
                const benchmarkTarget = await tx.benchmarkTarget.create({
                    data: {
                        benchmarkSetId: benchmarkId,
                        targetId: externalId,
                        moleculeId: targetMol.id,
                        smiles: targetData.smiles,
                        routeLength,
                        isConvergent,
                        metadata:
                            Object.keys(getAnnotations(targetData)).length > 0
                                ? JSON.stringify(getAnnotations(targetData))
                                : null,
                    },
                })

                // Create acceptable routes if they exist
                if (targetData.acceptable_routes && targetData.acceptable_routes.length > 0) {
                    for (let routeIndex = 0; routeIndex < targetData.acceptable_routes.length; routeIndex++) {
                        const routeData = targetData.acceptable_routes[routeIndex]
                        if (
                            routeData.target.smiles !== targetData.smiles ||
                            routeData.target.inchikey !== targetData.inchikey
                        ) {
                            throw new Error(
                                `Acceptable route ${routeIndex} root differs from benchmark target ${externalId}`
                            )
                        }

                        // Extract route properties from file
                        const projection = routeProjection(routeData)
                        const signature = projection.route.signature
                        const contentHash = hashJson(normalizeRouteForRetrocast(routeData))

                        let routeId: string

                        const existingRoute = await tx.route.findUnique({
                            where: { contentHash },
                            select: { id: true },
                        })
                        if (existingRoute) {
                            routeId = existingRoute.id
                        } else {
                            // Exact content is unique; the topology signature is intentionally non-unique.
                            // Any failure after this create must escape and roll back the target batch. It
                            // must never be mistaken for duplicate-route recovery.
                            const route = await tx.route.create({
                                data: {
                                    signature,
                                    contentHash,
                                    length: 0, // Will be set below
                                    isConvergent: false, // Will be set below
                                },
                                select: { id: true },
                            })
                            routeId = route.id

                            // Store route tree
                            const newMoleculesCreated = await storeRouteTree(route.id, routeData.target, tx)
                            moleculesCreated += newMoleculesCreated

                            // Use file data if available, otherwise compute
                            const routeLengthComputed = routeData.length ?? projection.route.length
                            const routeIsConvergentComputed =
                                routeData.has_convergent_reaction ?? projection.route.hasConvergentReaction

                            // Update route with final properties
                            await tx.route.update({
                                where: { id: route.id },
                                data: {
                                    length: routeLengthComputed,
                                    isConvergent: routeIsConvergentComputed,
                                },
                            })

                            routesCreated++
                        }

                        // Create AcceptableRoute junction record
                        await tx.acceptableRoute.create({
                            data: {
                                benchmarkTargetId: benchmarkTarget.id,
                                routeId,
                                routeIndex,
                            },
                        })
                        acceptableRoutesCreated++
                    }
                }
            }
        })

        if (
            process.env.NODE_ENV !== 'test' &&
            (Math.floor(Math.min(i + BATCH_SIZE, targetIds.length) / 100) > Math.floor(i / 100) ||
                i + BATCH_SIZE >= targetIds.length)
        ) {
            const processed = Math.min(i + BATCH_SIZE, targetIds.length)
            console.log(`Processed ${processed}/${targetIds.length} targets...`)
        }
    }

    // Update benchmark hasAcceptableRoutes flag if any AcceptableRoute junction records were created.
    // Note: we intentionally use `acceptableRoutesCreated` (not `routesCreated`) here so that
    // the flag is set even when all route structures were already in the DB from a previous load
    // and were reused by exact content hash (in which case routesCreated stays 0).
    if (acceptableRoutesCreated > 0) {
        await prisma.benchmarkSet.update({
            where: { id: benchmarkId },
            data: { hasAcceptableRoutes: true },
        })
        if (process.env.NODE_ENV !== 'test') {
            console.log('Updated benchmark hasAcceptableRoutes flag to true')
        }
    }

    if (process.env.NODE_ENV !== 'test') {
        console.log('Benchmark load complete!')
    }

    return {
        benchmarkId,
        benchmarkName,
        targetsLoaded: targetIds.length,
        moleculesCreated,
        moleculesReused,
        routesCreated,
        timeElapsed: 0, // Will be set by caller
    }
}
