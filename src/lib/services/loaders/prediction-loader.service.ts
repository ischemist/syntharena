import crypto from 'crypto'
import { projectRetrocastRoute } from '@ischemist/routes'
import type { RetrocastMolecule, RetrocastReaction, RetrocastRoute } from '@ischemist/routes'
import { Prisma, ReliabilityCode } from '@prisma/client'

import type { MetricResult, ModelStatistics, ReliabilityFlag, StratifiedMetric } from '@/types'
import prisma from '@/lib/db'
import { upsertReactionSteps } from '@/lib/services/loaders/reaction-step.helpers'

// Convenience alias so internal helpers can accept either the real client or a tx client.
type DbClient = typeof prisma | Prisma.TransactionClient

// ============================================================================
// Types for Python Data (matching retrocast Pydantic models)
// ============================================================================

export interface PythonMolecule {
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

export interface PythonRoute {
    target: PythonMolecule
    rank: number
    solvability?: Record<string, boolean>
    annotations?: Record<string, unknown>
    schema_version?: string
}

interface RetrocastAnalysisMetric {
    value: number
    count: number
    ci_low?: number
    ci_high?: number
    reliability?: {
        code: string
        message: string
    }
}

export interface RetrocastAnalysis {
    schema_version?: string
    metrics: Record<string, RetrocastAnalysisMetric>
    by_stratum?: Record<string, Record<string, RetrocastAnalysisMetric>>
    runtime?: {
        total_wall_time?: number | null
        total_cpu_time?: number | null
        mean_wall_time?: number | null
        mean_cpu_time?: number | null
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Computes route length (number of reaction steps).
 */
export function computeRouteLength(root: PythonMolecule): number {
    const step = getSynthesisStep(root)
    if (!step) return 0
    const childLengths = step.reactants.map(computeRouteLength)
    return 1 + Math.max(...childLengths, 0)
}

/**
 * Checks if route is convergent (two or more independent multi-step sub-syntheses merge).
 *
 * A route is convergent only when a reaction node has 2+ non-leaf reactants —
 * i.e. at least two reactants that are themselves synthesised (have their own steps).
 * A simple two-component reaction where both reactants are buyable starting materials
 * (leaves) is NOT convergent; it is just a bimolecular reaction.
 *
 * This definition matches the one used in benchmark-loader.service.ts
 * (`computeRouteProperties`): a node is convergent when it has ≥2 non-leaf children.
 */
export function isRouteConvergent(root: PythonMolecule): boolean {
    const step = getSynthesisStep(root)
    if (!step) return false
    const reactants = step.reactants
    // Count non-leaf reactants (reactants that themselves have synthesis steps)
    const nonLeafReactants = reactants.filter((r) => getSynthesisStep(r) !== null)
    if (nonLeafReactants.length >= 2) return true
    return reactants.some(isRouteConvergent)
}

function getSynthesisStep(molecule: PythonMolecule): PythonReactionStep | null {
    return molecule.product_of ?? null
}

function getAnnotations(value: { annotations?: Record<string, unknown> }): Record<string, unknown> {
    return value.annotations ?? {}
}

function normalizeMoleculeForRetrocast(molecule: PythonMolecule): RetrocastMolecule {
    const step = getSynthesisStep(molecule)
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

function routeMetadata(route: PythonRoute): Record<string, unknown> | undefined {
    const metadata = getAnnotations(route)
    return Object.keys(metadata).length > 0 ? metadata : undefined
}

function metricResultFromAnalysisMetric(metric: RetrocastAnalysisMetric): MetricResult {
    return {
        value: metric.value,
        ciLower: metric.ci_low ?? metric.value,
        ciUpper: metric.ci_high ?? metric.value,
        nSamples: metric.count,
        reliability: {
            code: (metric.reliability?.code ?? 'OK') as ReliabilityFlag['code'],
            message: metric.reliability?.message ?? 'Reliable.',
        },
    }
}

function metricKeyForSolvability(metrics: Record<string, RetrocastAnalysisMetric>): string {
    const solvabilityKey = Object.keys(metrics).find((key) => /^solv_0\[.+\]_rate$/.test(key))
    if (!solvabilityKey) {
        throw new Error('RetroCast analysis is missing a solv_0[...]_rate metric')
    }
    return solvabilityKey
}

function topKFromMetricName(metricName: string): string | null {
    const match = metricName.match(/^acceptable_reconstruction_top_(\d+)\[.+\]$/)
    return match?.[1] ?? null
}

function stratumGroupKey(stratum: string): number | null {
    const match = stratum.match(/\d+/)
    return match ? parseInt(match[0], 10) : null
}

/**
 * Converts RetroCast v0.7 analysis.json.gz payloads into SynthArena's metric DTO.
 */
export function transformRetrocastAnalysis(analysis: RetrocastAnalysis): ModelStatistics {
    const solvabilityKey = metricKeyForSolvability(analysis.metrics)
    const solvabilityByGroup: Record<number, MetricResult> = {}
    const topKAccuracy: Record<string, StratifiedMetric> = {}

    for (const [stratum, metrics] of Object.entries(analysis.by_stratum ?? {})) {
        const groupKey = stratumGroupKey(stratum)
        if (groupKey === null) continue

        const solvabilityMetric = metrics[solvabilityKey]
        if (solvabilityMetric) {
            solvabilityByGroup[groupKey] = metricResultFromAnalysisMetric(solvabilityMetric)
        }

        for (const [metricName, metric] of Object.entries(metrics)) {
            const topK = topKFromMetricName(metricName)
            if (!topK) continue
            topKAccuracy[topK] ??= {
                metricName: `Top-${topK}`,
                overall: metricResultFromAnalysisMetric(analysis.metrics[metricName] ?? metric),
                byGroup: {},
            }
            topKAccuracy[topK].byGroup[groupKey] = metricResultFromAnalysisMetric(metric)
        }
    }

    for (const [metricName, metric] of Object.entries(analysis.metrics)) {
        const topK = topKFromMetricName(metricName)
        if (!topK) continue
        topKAccuracy[topK] ??= {
            metricName: `Top-${topK}`,
            overall: metricResultFromAnalysisMetric(metric),
            byGroup: {},
        }
    }

    return {
        solvability: {
            metricName: 'Solvability',
            overall: metricResultFromAnalysisMetric(analysis.metrics[solvabilityKey]),
            byGroup: solvabilityByGroup,
        },
        ...(Object.keys(topKAccuracy).length > 0 && { topKAccuracy }),
        totalWallTime: analysis.runtime?.total_wall_time,
        totalCpuTime: analysis.runtime?.total_cpu_time,
        meanWallTime: analysis.runtime?.mean_wall_time,
        meanCpuTime: analysis.runtime?.mean_cpu_time,
    }
}

// ============================================================================
// Core Write Functions
// ============================================================================

/**
 * Creates or updates a PredictionRun record.
 * Use this before loading routes to ensure the run exists.
 *
 * @param benchmarkId - Benchmark set ID
 * @param modelInstanceId - Model instance ID
 * @param metadata - Optional metadata (retrocast version, command params, etc.)
 * @returns Created or updated PredictionRun
 * @throws Error if benchmark or model not found
 */
export async function createOrUpdatePredictionRun(
    benchmarkId: string,
    modelInstanceId: string,
    metadata?: {
        retrocastVersion?: string
        commandParams?: Record<string, unknown>
        executedAt?: Date
        hourlyCost?: number
    }
): Promise<{ id: string; benchmarkSetId: string; modelInstanceId: string }> {
    // Verify benchmark exists
    const benchmark = await prisma.benchmarkSet.findUnique({
        where: { id: benchmarkId },
        select: { id: true },
    })
    if (!benchmark) {
        throw new Error('Benchmark not found')
    }

    // Verify model exists
    const model = await prisma.modelInstance.findUnique({
        where: { id: modelInstanceId },
        select: { id: true },
    })
    if (!model) {
        throw new Error('Model instance not found')
    }

    // Upsert (find or create) the prediction run
    const run = await prisma.predictionRun.upsert({
        where: {
            modelInstanceId_benchmarkSetId: {
                modelInstanceId,
                benchmarkSetId: benchmarkId,
            },
        },
        update: {
            retrocastVersion: metadata?.retrocastVersion,
            commandParams: metadata?.commandParams ? JSON.stringify(metadata.commandParams) : undefined,
            executedAt: metadata?.executedAt,
            hourlyCost: metadata?.hourlyCost,
        },
        create: {
            modelInstanceId,
            benchmarkSetId: benchmarkId,
            retrocastVersion: metadata?.retrocastVersion,
            commandParams: metadata?.commandParams ? JSON.stringify(metadata.commandParams) : undefined,
            executedAt: metadata?.executedAt ?? new Date(),
            hourlyCost: metadata?.hourlyCost,
            totalRoutes: 0, // Will be updated later
        },
        select: { id: true, benchmarkSetId: true, modelInstanceId: true },
    })

    return run
}

/**
 * Creates or reuses a Molecule record by InChiKey.
 * Molecules are deduplicated globally by InChiKey (canonical identifier).
 *
 * @param pythonMolecule - Python molecule object with smiles and inchikey
 * @returns Created or existing Molecule
 */
export async function createMoleculeFromPython(pythonMolecule: PythonMolecule): Promise<{
    id: string
    inchikey: string
    smiles: string
}> {
    const molecule = await prisma.molecule.upsert({
        where: { inchikey: pythonMolecule.inchikey },
        update: {}, // No update needed - InChiKey is canonical
        create: {
            inchikey: pythonMolecule.inchikey,
            smiles: pythonMolecule.smiles,
        },
        select: { id: true, inchikey: true, smiles: true },
    })

    return molecule
}

/**
 * Internal structure for building route nodes in memory before bulk insert.
 * Reaction data (reactionHash, template, metadata) is stored temporarily here
 * for ReactionStep upsert, then only the reactionStepId is written to RouteNode.
 */
interface RouteNodeToCreate {
    tempId: string // Temporary ID for tracking parent-child relationships
    routeId: string
    moleculeInchikey: string
    parentTempId: string | null
    isLeaf: boolean
    reactionHash: string | null // Used for ReactionStep dedup, not stored on RouteNode
    template: string | null // Stored on ReactionStep, not RouteNode
    metadata: string | null // Stored on ReactionStep, not RouteNode
}

/**
 * Recursively collects all molecules and nodes from a route tree in memory.
 * Avoids N+1 query problem by gathering data before database operations.
 *
 * @param pythonMol - Current molecule in the tree
 * @param routeId - The route ID
 * @param parentTempId - Parent's temporary ID
 * @param molecules - Map to collect unique molecules
 * @param nodes - Array to collect all nodes
 * @param tempIdCounter - Counter for generating temporary IDs
 * @returns Temporary ID of the created node
 */
function collectRouteTreeData(
    pythonMol: PythonMolecule,
    routeId: string,
    parentTempId: string | null,
    molecules: Map<string, { smiles: string; inchikey: string }>,
    nodes: RouteNodeToCreate[],
    tempIdCounter: { value: number }
): string {
    // Add molecule to collection if not already present
    if (!molecules.has(pythonMol.inchikey)) {
        molecules.set(pythonMol.inchikey, {
            smiles: pythonMol.smiles,
            inchikey: pythonMol.inchikey,
        })
    }

    // Generate temporary ID for this node
    const tempId = `temp-${tempIdCounter.value++}`

    // Determine if this is a leaf node
    const step = getSynthesisStep(pythonMol)
    const isLeaf = !step || pythonMol.is_leaf === true

    // Compute reaction hash if not a leaf (uses InChIKeys for canonical identity)
    let reactionHash: string | null = null
    if (step) {
        reactionHash = computeReactionHash(step, pythonMol.inchikey)
    }

    // Prepare node metadata (reagents, solvents, mapped_reaction_smiles)
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

    // Create node data structure
    const node: RouteNodeToCreate = {
        tempId,
        routeId,
        moleculeInchikey: pythonMol.inchikey,
        parentTempId,
        isLeaf,
        reactionHash,
        template: step?.template ?? null,
        metadata,
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
 * Stores route tree using bulk operations to avoid N+1 query problem.
 * Collects all molecules and nodes in memory first, then performs bulk inserts.
 *
 * @param pythonMol - Root molecule (target)
 * @param routeId - Route ID these nodes belong to
 * @param db - Prisma client or transaction client (defaults to the global client)
 * @returns Created root node
 */
async function storeRouteTree(
    pythonMol: PythonMolecule,
    routeId: string,
    db: DbClient = prisma
): Promise<{ id: string; moleculeId: string }> {
    // Step 1: Collect all unique molecules and nodes in memory
    const moleculesMap = new Map<string, { smiles: string; inchikey: string }>()
    const nodesData: RouteNodeToCreate[] = []
    const tempIdCounter = { value: 0 }

    collectRouteTreeData(pythonMol, routeId, null, moleculesMap, nodesData, tempIdCounter)

    // Step 2: Bulk handle molecules
    const uniqueInchikeys = Array.from(moleculesMap.keys())

    // Find existing molecules
    const existingMolecules = await db.molecule.findMany({
        where: { inchikey: { in: uniqueInchikeys } },
        select: { id: true, inchikey: true },
    })

    const existingInchikeyToId = new Map(existingMolecules.map((m) => [m.inchikey, m.id]))

    // Create new molecules (molecules not in database yet)
    const newMolecules = Array.from(moleculesMap.values()).filter((m) => !existingInchikeyToId.has(m.inchikey))

    if (newMolecules.length > 0) {
        // Create molecules individually (SQLite doesn't support skipDuplicates in createMany).
        // Running inside a transaction means concurrent calls cannot interleave between
        // the findMany check above and these creates, eliminating the P2002 race.
        const createdMolecules = await Promise.all(
            newMolecules.map((m) =>
                db.molecule.create({
                    data: m,
                    select: { id: true, inchikey: true },
                })
            )
        )

        for (const mol of createdMolecules) {
            existingInchikeyToId.set(mol.inchikey, mol.id)
        }
    }

    // Step 3: Upsert ReactionStep records for non-leaf nodes
    const reactionHashToId = await upsertReactionSteps(nodesData, db)

    // Step 4: Create all nodes with proper parent-child relationships
    // Build node map by parent to enable breadth-first creation
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
    let rootNodeId: string | null = null
    let rootMoleculeId: string | null = null

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

            const createdNode = await db.routeNode.create({
                data: {
                    routeId: nodeData.routeId,
                    moleculeId,
                    parentId,
                    isLeaf: nodeData.isLeaf,
                    reactionStepId,
                },
                select: { id: true },
            })

            tempIdToRealId.set(nodeData.tempId, createdNode.id)

            // Track root node
            if (nodeData.parentTempId === null) {
                rootNodeId = createdNode.id
                rootMoleculeId = moleculeId
            }

            // Add children to queue
            const children = nodesByParent.get(nodeData.tempId) || []
            queue.push(...children)
        }
    }

    if (!rootNodeId || !rootMoleculeId) {
        throw new Error('Failed to create root node')
    }

    return { id: rootNodeId, moleculeId: rootMoleculeId }
}

/**
 * Creates or reuses a Route record from Python route object with GLOBAL deduplication.
 * Routes are now unique by signature (topology hash). If a route with the same
 * signature exists, it is reused. Otherwise, a new Route + RouteNode tree is created.
 * Always creates a new PredictionRoute junction record linking the route to this prediction.
 *
 * @param pythonRoute - Python route object
 * @param predictionRunId - PredictionRun ID
 * @param targetId - BenchmarkTarget ID (not the external target_id string)
 * @returns Object with routeId and predictionRouteId
 * @throws Error if target not found or duplicate prediction exists
 */
export async function createRouteFromPython(
    pythonRoute: PythonRoute,
    predictionRunId: string,
    targetId: string
): Promise<{ routeId: string; predictionRouteId: string; rank: number; wasReused: boolean }> {
    // Verify target exists (outside the transaction — read-only check, safe to do early)
    const target = await prisma.benchmarkTarget.findUnique({
        where: { id: targetId },
        select: { id: true },
    })
    if (!target) {
        throw new Error(`Target not found: ${targetId}`)
    }

    // Read route properties from Python JSON.
    // SynthArena treats route identity as topology-only and deduplicates by signature.
    const routeProjection = projectRetrocastRoute(normalizeRouteForRetrocast(pythonRoute))
    const signature = routeProjection.route.signature
    const length = routeProjection.route.length
    const isConvergent = routeProjection.route.hasConvergentReaction

    // Wrap the entire create-or-reuse + prediction creation in a single transaction.
    // This eliminates two race conditions present in the original code:
    //   1. Two concurrent calls creating the same Route (P2002 on signature).
    //   2. Two concurrent calls creating the same Molecule inside storeRouteTree (P2002 on inchikey).
    // The try/catch pattern mirrors benchmark-loader.service.ts.
    return await prisma.$transaction(async (tx) => {
        let wasReused = false
        let routeId: string

        try {
            // Step 1: Try to create the Route record.
            // Will throw a unique-constraint error if another concurrent call beat us to it.
            const route = await tx.route.create({
                data: {
                    signature,
                    length,
                    isConvergent,
                },
                select: { id: true },
            })
            routeId = route.id
        } catch (createError) {
            // Route already exists (unique constraint violation on signature) — find and reuse it.
            const existingRoute = await tx.route.findUnique({
                where: { signature },
                select: { id: true },
            })

            if (!existingRoute) {
                // Not a duplicate-key error — re-throw the original error.
                throw createError
            }

            routeId = existingRoute.id
            wasReused = true
        }

        // Step 2: Store the RouteNode tree (molecules + nodes) inside the same transaction.
        // Only needed for newly created routes (not reused ones).
        if (!wasReused) {
            await storeRouteTree(pythonRoute.target, routeId, tx)
        }

        // Step 3: Guard against duplicate prediction (same route + run + target).
        // The unique constraint @@unique([routeId, predictionRunId, targetId]) on PredictionRoute
        // would catch this at the DB level too, but we provide a friendlier error message here.
        const existingPrediction = await tx.predictionRoute.findFirst({
            where: {
                routeId,
                predictionRunId,
                targetId,
            },
            select: { id: true },
        })

        if (existingPrediction) {
            throw new Error(
                `Duplicate prediction detected: route ${routeId} already predicted for target ${targetId} in run ${predictionRunId}`
            )
        }

        // Step 4: Create PredictionRoute junction record.
        const metadata = routeMetadata(pythonRoute)

        const predictionRoute = await tx.predictionRoute.create({
            data: {
                routeId,
                predictionRunId,
                targetId,
                rank: pythonRoute.rank,
                metadata: metadata ? JSON.stringify(metadata) : null,
            },
            select: { id: true },
        })

        return {
            routeId,
            predictionRouteId: predictionRoute.id,
            rank: pythonRoute.rank,
            wasReused,
        }
    })
}

/**
 * Creates or updates a RouteSolvability record.
 * Links a PREDICTION ROUTE to a stock with solvability status and stratification data.
 * NOTE: Solvability is per-prediction, not per-route structure.
 *
 * @param predictionRouteId - PredictionRoute ID
 * @param stockId - Stock ID
 * @param isSolvable - Can this route be solved with the stock?
 * @param matchesAcceptable - Does this route match any acceptable route?
 * @param matchedAcceptableIndex - Index of matched acceptable route (0-based), or null
 * @param stratificationLength - Route length for stratification (from Python TargetEvaluation)
 * @param stratificationIsConvergent - Is route convergent for stratification
 * @param wallTime - Wall time for this evaluation (seconds)
 * @param cpuTime - CPU time for this evaluation (seconds)
 * @returns Created or updated RouteSolvability
 * @throws Error if predictionRoute or stock not found
 */
export async function createRouteSolvability(
    predictionRouteId: string,
    stockId: string,
    isSolvable: boolean,
    matchesAcceptable: boolean,
    matchedAcceptableIndex: number | null,
    stratificationLength: number | null,
    stratificationIsConvergent: boolean | null,
    wallTime: number | null,
    cpuTime: number | null
): Promise<{ id: string; predictionRouteId: string; stockId: string }> {
    // Verify predictionRoute exists
    const predictionRoute = await prisma.predictionRoute.findUnique({
        where: { id: predictionRouteId },
        select: { id: true },
    })
    if (!predictionRoute) {
        throw new Error(`PredictionRoute not found: ${predictionRouteId}`)
    }

    // Verify stock exists
    const stock = await prisma.stock.findUnique({
        where: { id: stockId },
        select: { id: true },
    })
    if (!stock) {
        throw new Error(`Stock not found: ${stockId}`)
    }

    // Upsert solvability record
    const solvability = await prisma.routeSolvability.upsert({
        where: {
            predictionRouteId_stockId: {
                predictionRouteId,
                stockId,
            },
        },
        update: {
            isSolvable,
            matchesAcceptable,
            matchedAcceptableIndex,
            stratificationLength,
            stratificationIsConvergent,
            wallTime,
            cpuTime,
        },
        create: {
            predictionRouteId,
            stockId,
            isSolvable,
            matchesAcceptable,
            matchedAcceptableIndex,
            stratificationLength,
            stratificationIsConvergent,
            wallTime,
            cpuTime,
        },
        select: { id: true, predictionRouteId: true, stockId: true },
    })

    return solvability
}

/**
 * Creates ModelRunStatistics and associated StratifiedMetricGroup records.
 * Parses Python ModelStatistics object and stores in normalized form.
 *
 * @param predictionRunId - PredictionRun ID
 * @param benchmarkSetId - BenchmarkSet ID (for relation)
 * @param stockId - Stock ID
 * @param pythonStatistics - Python ModelStatistics object
 * @returns Created ModelRunStatistics with ID
 * @throws Error if run or stock not found
 */
export async function createModelStatistics(
    predictionRunId: string,
    benchmarkSetId: string,
    stockId: string,
    pythonStatistics: ModelStatistics
): Promise<{ id: string; predictionRunId: string; stockId: string }> {
    // Verify prediction run exists
    const run = await prisma.predictionRun.findUnique({
        where: { id: predictionRunId },
        select: { id: true },
    })
    if (!run) {
        throw new Error(`Prediction run not found: ${predictionRunId}`)
    }

    // Verify stock exists
    const stock = await prisma.stock.findUnique({
        where: { id: stockId },
        select: { id: true },
    })
    if (!stock) {
        throw new Error(`Stock not found: ${stockId}`)
    }

    // Helper to convert TypeScript ReliabilityCode to Prisma enum
    const mapReliabilityCode = (code: string): ReliabilityCode => {
        switch (code) {
            case 'OK':
                return ReliabilityCode.OK
            case 'LOW_N':
                return ReliabilityCode.LOW_N
            case 'EXTREME_P':
                return ReliabilityCode.EXTREME_P
            default:
                throw new Error(`Unknown reliability code "${code}" encountered.`)
        }
    }

    // Helper to create metric group records from StratifiedMetric
    const createMetricRecords = (
        statisticsId: string,
        metricName: string,
        metric: StratifiedMetric
    ): Prisma.StratifiedMetricGroupCreateManyInput[] => {
        const records: Prisma.StratifiedMetricGroupCreateManyInput[] = []

        // Overall metric (groupKey = null)
        records.push({
            statisticsId,
            metricName,
            groupKey: null,
            value: metric.overall.value,
            ciLower: metric.overall.ciLower,
            ciUpper: metric.overall.ciUpper,
            nSamples: metric.overall.nSamples,
            reliabilityCode: mapReliabilityCode(metric.overall.reliability.code),
            reliabilityMessage: metric.overall.reliability.message,
        })

        // Stratified metrics (by group, e.g., route length)
        for (const [groupKeyStr, metricResult] of Object.entries(metric.byGroup)) {
            const groupKey = parseInt(groupKeyStr, 10)
            records.push({
                statisticsId,
                metricName,
                groupKey,
                value: metricResult.value,
                ciLower: metricResult.ciLower,
                ciUpper: metricResult.ciUpper,
                nSamples: metricResult.nSamples,
                reliabilityCode: mapReliabilityCode(metricResult.reliability.code),
                reliabilityMessage: metricResult.reliability.message,
            })
        }

        return records
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
        // Delete existing statistics for this run+stock (if re-running)
        await tx.modelRunStatistics.deleteMany({
            where: {
                predictionRunId,
                stockId,
            },
        })

        // Create ModelRunStatistics record
        const statistics = await tx.modelRunStatistics.create({
            data: {
                predictionRunId,
                benchmarkSetId,
                stockId,
                statisticsJson: JSON.stringify(pythonStatistics),
                // Store runtime metrics at top level for easy querying
                totalWallTime: pythonStatistics.totalWallTime ?? null,
                totalCpuTime: pythonStatistics.totalCpuTime ?? null,
                meanWallTime: pythonStatistics.meanWallTime ?? null,
                meanCpuTime: pythonStatistics.meanCpuTime ?? null,
            },
            select: { id: true, predictionRunId: true, stockId: true },
        })

        // Collect all metric records to create
        const metricRecords: Prisma.StratifiedMetricGroupCreateManyInput[] = []

        // Add solvability metrics
        metricRecords.push(...createMetricRecords(statistics.id, 'Solvability', pythonStatistics.solvability))

        // Add top-k accuracy metrics (if present)
        if (pythonStatistics.topKAccuracy) {
            for (const [k, metric] of Object.entries(pythonStatistics.topKAccuracy)) {
                metricRecords.push(...createMetricRecords(statistics.id, `Top-${k}`, metric))
            }
        }

        // Batch insert all metrics
        if (metricRecords.length > 0) {
            await tx.stratifiedMetricGroup.createMany({
                data: metricRecords,
            })
        }

        return statistics
    })

    return result
}

/**
 * Calculates and updates the total cost for a PredictionRun.
 * Call this after loading statistics to populate totalCost based on hourlyCost and totalWallTime.
 *
 * Formula: totalCost = hourlyCost * (totalWallTime / 3600)
 *
 * @param predictionRunId - PredictionRun ID
 * @returns Updated PredictionRun with totalCost, or null if cost cannot be calculated
 * @throws Error if run not found
 */
export async function updatePredictionRunCost(predictionRunId: string): Promise<{
    id: string
    hourlyCost: number
    totalCost: number
} | null> {
    // Get the run with its hourly cost
    const run = await prisma.predictionRun.findUnique({
        where: { id: predictionRunId },
        select: { id: true, hourlyCost: true },
    })

    if (!run) {
        throw new Error(`Prediction run not found: ${predictionRunId}`)
    }

    // If no hourly cost specified, can't calculate total cost
    if (!run.hourlyCost) {
        return null
    }

    // Get the totalWallTime from ModelRunStatistics (should only be one record per run)
    const statistics = await prisma.modelRunStatistics.findFirst({
        where: { predictionRunId },
        select: { totalWallTime: true },
    })

    // If no statistics or no wall time, can't calculate total cost
    if (!statistics?.totalWallTime) {
        return null
    }

    // Calculate total cost: hourlyCost * (totalWallTime / 3600)
    // totalWallTime is in seconds, convert to hours
    const totalCost = run.hourlyCost * (statistics.totalWallTime / 3600)

    // Update the run with calculated cost
    const updatedRun = await prisma.predictionRun.update({
        where: { id: predictionRunId },
        data: { totalCost },
        select: {
            id: true,
            hourlyCost: true,
            totalCost: true,
        },
    })

    return {
        id: updatedRun.id,
        hourlyCost: updatedRun.hourlyCost!,
        totalCost: updatedRun.totalCost!,
    }
}

/**
 * Updates aggregate statistics for a PredictionRun.
 * Call this after loading all predictions for a run.
 * NOTE: Now counts PredictionRoutes, not Routes (deduplication is enabled).
 *
 * Uses a raw SQL query to perform aggregation in the database, avoiding
 * high memory consumption for runs with a large number of routes.
 *
 * @param predictionRunId - PredictionRun ID
 * @returns Updated PredictionRun
 * @throws Error if run not found
 */
export async function updatePredictionRunStats(predictionRunId: string): Promise<{
    id: string
    totalRoutes: number
    avgRouteLength: number
}> {
    // Verify run exists
    const run = await prisma.predictionRun.findUnique({
        where: { id: predictionRunId },
        select: { id: true },
    })
    if (!run) {
        throw new Error(`Prediction run not found: ${predictionRunId}`)
    }

    // Compute aggregate stats using raw SQL to avoid loading all routes into memory
    // This query counts predictions and calculates average route length in the database
    const result = await prisma.$queryRaw<[{ totalRoutes: number; avgRouteLength: number | null }]>`
        SELECT
            COUNT(*) as totalRoutes,
            AVG(r.length) as avgRouteLength
        FROM PredictionRoute pr
        INNER JOIN Route r ON r.id = pr.routeId
        WHERE pr.predictionRunId = ${predictionRunId}
    `

    const totalRoutes = Number(result[0]?.totalRoutes ?? 0)
    const avgRouteLength = result[0]?.avgRouteLength !== null ? Number(result[0].avgRouteLength) : 0

    // Update run record
    const updatedRun = await prisma.predictionRun.update({
        where: { id: predictionRunId },
        data: {
            totalRoutes,
            avgRouteLength,
        },
        select: {
            id: true,
            totalRoutes: true,
            avgRouteLength: true,
        },
    })

    return {
        id: updatedRun.id,
        totalRoutes: updatedRun.totalRoutes,
        avgRouteLength: updatedRun.avgRouteLength ?? 0,
    }
}
