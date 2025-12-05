import crypto from 'crypto'
import { Prisma, ReliabilityCode } from '@prisma/client'

import type { MetricResult, ModelStatistics, ReliabilityFlag, StratifiedMetric } from '@/types'
import prisma from '@/lib/db'

// ============================================================================
// Types for Python Data (matching retrocast Pydantic models)
// ============================================================================

export interface PythonMolecule {
    smiles: string
    inchikey: string
    synthesis_step: PythonReactionStep | null
    metadata?: Record<string, unknown>
    is_leaf?: boolean
}

export interface PythonReactionStep {
    reactants: PythonMolecule[]
    mapped_smiles?: string | null
    template?: string | null
    reagents?: string[] | null
    solvents?: string[] | null
    metadata?: Record<string, unknown>
    is_convergent?: boolean
}

export interface PythonRoute {
    target: PythonMolecule
    rank: number
    solvability?: Record<string, boolean>
    metadata?: Record<string, unknown>
    content_hash: string
    signature: string
}

// Types for Python statistics data (snake_case)
export interface PythonMetricResult {
    value: number
    ci_lower: number
    ci_upper: number
    n_samples: number
    reliability: {
        code: string
        message: string
    }
}

export interface PythonStratifiedMetric {
    metric_name: string
    overall: PythonMetricResult
    by_group?: Record<string, PythonMetricResult>
}

export interface PythonModelStatistics {
    solvability: PythonStratifiedMetric
    top_k_accuracy?: Record<string, PythonStratifiedMetric>
    rank_distribution?: {
        rank: number
        probability: number
    }[]
    expected_rank?: number
    // Runtime metrics (in seconds) from Python ModelStatistics
    total_wall_time?: number | null
    total_cpu_time?: number | null
    mean_wall_time?: number | null
    mean_cpu_time?: number | null
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Computes route length (number of reaction steps).
 */
function computeRouteLength(root: PythonMolecule): number {
    if (!root.synthesis_step) return 0
    const childLengths = root.synthesis_step.reactants.map(computeRouteLength)
    return 1 + Math.max(...childLengths, 0)
}

/**
 * Checks if route is convergent (multiple branches meet at a common node).
 */
function isRouteConvergent(root: PythonMolecule): boolean {
    if (!root.synthesis_step) return false
    const reactants = root.synthesis_step.reactants
    if (reactants.length > 1) return true // Multiple reactants = convergent
    return reactants.some(isRouteConvergent)
}

/**
 * Computes reaction hash for a synthesis step.
 * Used to detect duplicate reactions across routes.
 */
function computeReactionHash(step: PythonReactionStep, productSmiles: string): string {
    const reactantSmiles = step.reactants.map((r) => r.smiles).sort()
    const content = `${productSmiles}>>${reactantSmiles.join('.')}`
    return crypto.createHash('sha256').update(content).digest('hex')
}

/**
 * Transforms Python snake_case statistics JSON to TypeScript camelCase.
 * Converts field names to match TypeScript ModelStatistics interface.
 *
 * @param pythonStats - Raw Python statistics object with snake_case keys
 * @returns ModelStatistics object with camelCase keys
 */
export function transformPythonStatistics(pythonStats: PythonModelStatistics): ModelStatistics {
    // Helper to transform a single metric result
    const transformMetricResult = (pythonResult: PythonMetricResult): MetricResult => ({
        value: pythonResult.value,
        ciLower: pythonResult.ci_lower,
        ciUpper: pythonResult.ci_upper,
        nSamples: pythonResult.n_samples,
        reliability: {
            code: pythonResult.reliability.code as ReliabilityFlag['code'],
            message: pythonResult.reliability.message,
        },
    })

    // Helper to transform a stratified metric
    const transformStratifiedMetric = (pythonMetric: PythonStratifiedMetric): StratifiedMetric => ({
        metricName: pythonMetric.metric_name,
        overall: transformMetricResult(pythonMetric.overall),
        byGroup: Object.fromEntries(
            Object.entries(pythonMetric.by_group || {}).map(([key, value]: [string, PythonMetricResult]) => [
                parseInt(key, 10),
                transformMetricResult(value),
            ])
        ),
    })

    // Transform the full statistics object
    const result: ModelStatistics = {
        solvability: transformStratifiedMetric(pythonStats.solvability),
    }

    // Transform top_k_accuracy if present
    if (pythonStats.top_k_accuracy) {
        result.topKAccuracy = Object.fromEntries(
            Object.entries(pythonStats.top_k_accuracy).map(([k, metric]: [string, PythonStratifiedMetric]) => [
                k,
                transformStratifiedMetric(metric),
            ])
        )
    }

    // Transform optional fields if present
    if (pythonStats.rank_distribution) {
        result.rankDistribution = pythonStats.rank_distribution
    }
    if (pythonStats.expected_rank !== undefined) {
        result.expectedRank = pythonStats.expected_rank
    }

    // Transform runtime metrics (in seconds)
    if (pythonStats.total_wall_time !== undefined && pythonStats.total_wall_time !== null) {
        result.totalWallTime = pythonStats.total_wall_time
    }
    if (pythonStats.total_cpu_time !== undefined && pythonStats.total_cpu_time !== null) {
        result.totalCpuTime = pythonStats.total_cpu_time
    }
    if (pythonStats.mean_wall_time !== undefined && pythonStats.mean_wall_time !== null) {
        result.meanWallTime = pythonStats.mean_wall_time
    }
    if (pythonStats.mean_cpu_time !== undefined && pythonStats.mean_cpu_time !== null) {
        result.meanCpuTime = pythonStats.mean_cpu_time
    }

    return result
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
        totalTimeMs?: number
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
            totalTimeMs: metadata?.totalTimeMs,
        },
        create: {
            modelInstanceId,
            benchmarkSetId: benchmarkId,
            retrocastVersion: metadata?.retrocastVersion,
            commandParams: metadata?.commandParams ? JSON.stringify(metadata.commandParams) : undefined,
            executedAt: metadata?.executedAt ?? new Date(),
            totalTimeMs: metadata?.totalTimeMs,
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
 */
interface RouteNodeToCreate {
    tempId: string // Temporary ID for tracking parent-child relationships
    routeId: string
    moleculeInchikey: string
    parentTempId: string | null
    isLeaf: boolean
    reactionHash: string | null
    template: string | null
    metadata: string | null
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
    const isLeaf = !pythonMol.synthesis_step || pythonMol.is_leaf === true

    // Compute reaction hash if not a leaf
    let reactionHash: string | null = null
    if (pythonMol.synthesis_step) {
        reactionHash = computeReactionHash(pythonMol.synthesis_step, pythonMol.smiles)
    }

    // Prepare node metadata (reagents, solvents, mapped_smiles)
    let metadata: string | null = null
    if (pythonMol.synthesis_step) {
        const metadataObj: Record<string, unknown> = {}
        if (pythonMol.synthesis_step.reagents) metadataObj.reagents = pythonMol.synthesis_step.reagents
        if (pythonMol.synthesis_step.solvents) metadataObj.solvents = pythonMol.synthesis_step.solvents
        if (pythonMol.synthesis_step.mapped_smiles) metadataObj.mapped_smiles = pythonMol.synthesis_step.mapped_smiles
        if (pythonMol.synthesis_step.metadata) metadataObj.python_metadata = pythonMol.synthesis_step.metadata
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
        template: pythonMol.synthesis_step?.template ?? null,
        metadata,
    }
    nodes.push(node)

    // Recursively process reactants
    if (pythonMol.synthesis_step?.reactants) {
        for (const reactant of pythonMol.synthesis_step.reactants) {
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
 * @returns Created root node
 */
async function storeRouteTree(pythonMol: PythonMolecule, routeId: string): Promise<{ id: string; moleculeId: string }> {
    // Step 1: Collect all unique molecules and nodes in memory
    const moleculesMap = new Map<string, { smiles: string; inchikey: string }>()
    const nodesData: RouteNodeToCreate[] = []
    const tempIdCounter = { value: 0 }

    collectRouteTreeData(pythonMol, routeId, null, moleculesMap, nodesData, tempIdCounter)

    // Step 2: Bulk handle molecules
    const uniqueInchikeys = Array.from(moleculesMap.keys())

    // Find existing molecules
    const existingMolecules = await prisma.molecule.findMany({
        where: { inchikey: { in: uniqueInchikeys } },
        select: { id: true, inchikey: true },
    })

    const existingInchikeyToId = new Map(existingMolecules.map((m) => [m.inchikey, m.id]))

    // Create new molecules (molecules not in database yet)
    const newMolecules = Array.from(moleculesMap.values()).filter((m) => !existingInchikeyToId.has(m.inchikey))

    if (newMolecules.length > 0) {
        // Create molecules individually (SQLite doesn't support skipDuplicates in createMany)
        const createdMolecules = await Promise.all(
            newMolecules.map((m) =>
                prisma.molecule.create({
                    data: m,
                    select: { id: true, inchikey: true },
                })
            )
        )

        for (const mol of createdMolecules) {
            existingInchikeyToId.set(mol.inchikey, mol.id)
        }
    }

    // Step 3: Create all nodes with proper parent-child relationships
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

            const createdNode = await prisma.routeNode.create({
                data: {
                    routeId: nodeData.routeId,
                    moleculeId,
                    parentId,
                    isLeaf: nodeData.isLeaf,
                    reactionHash: nodeData.reactionHash,
                    template: nodeData.template,
                    metadata: nodeData.metadata,
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
    // Verify target exists
    const target = await prisma.benchmarkTarget.findUnique({
        where: { id: targetId },
        select: { id: true },
    })
    if (!target) {
        throw new Error(`Target not found: ${targetId}`)
    }

    // Read route properties from Python JSON
    // Use content_hash and signature computed by Python, don't recompute
    const contentHash = pythonRoute.content_hash
    const signature = pythonRoute.signature
    const length = computeRouteLength(pythonRoute.target)
    const isConvergent = isRouteConvergent(pythonRoute.target)

    // Step 1: Check if Route exists globally by signature
    let route = await prisma.route.findFirst({
        where: { signature },
        select: { id: true },
    })

    let wasReused = false

    if (!route) {
        // Step 2a: Route doesn't exist - create new Route + RouteNode tree
        route = await prisma.route.create({
            data: {
                signature,
                contentHash,
                length,
                isConvergent,
            },
            select: { id: true },
        })

        // Create RouteNode tree using bulk operations
        await storeRouteTree(pythonRoute.target, route.id)
    } else {
        wasReused = true
    }

    // Step 3: Check if this prediction already exists (same route, run, target)
    const existingPrediction = await prisma.predictionRoute.findFirst({
        where: {
            routeId: route.id,
            predictionRunId,
            targetId,
        },
        select: { id: true },
    })

    if (existingPrediction) {
        throw new Error(
            `Duplicate prediction detected: route ${route.id} already predicted for target ${targetId} in run ${predictionRunId}`
        )
    }

    // Step 4: Create PredictionRoute junction record
    const metadata = pythonRoute.metadata ? JSON.stringify(pythonRoute.metadata) : null

    const predictionRoute = await prisma.predictionRoute.create({
        data: {
            routeId: route.id,
            predictionRunId,
            targetId,
            rank: pythonRoute.rank,
            metadata,
        },
        select: { id: true },
    })

    return {
        routeId: route.id,
        predictionRouteId: predictionRoute.id,
        rank: pythonRoute.rank,
        wasReused,
    }
}

/**
 * Creates or updates a RouteSolvability record.
 * Links a PREDICTION ROUTE (not a route) to a stock with solvability status.
 * NOTE: Solvability is per-prediction, not per-route structure.
 *
 * @param predictionRouteId - PredictionRoute ID
 * @param stockId - Stock ID
 * @param isSolvable - Can this route be solved with the stock?
 * @param matchesAcceptable - Does this route match any acceptable route?
 * @param matchedAcceptableIndex - Index of matched acceptable route (0-based), or null if no match
 * @returns Created or updated RouteSolvability
 * @throws Error if predictionRoute or stock not found
 */
export async function createRouteSolvability(
    predictionRouteId: string,
    stockId: string,
    isSolvable: boolean,
    matchesAcceptable: boolean,
    matchedAcceptableIndex: number | null
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
        },
        create: {
            predictionRouteId,
            stockId,
            isSolvable,
            matchesAcceptable,
            matchedAcceptableIndex,
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
                return ReliabilityCode.OK
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
