import * as fs from 'fs'
import * as zlib from 'zlib'
import { Prisma } from '@prisma/client'

import type { LoadBenchmarkResult, Route, RouteNodeWithDetails, RouteVisualizationData } from '@/types'
import prisma from '@/lib/db'

// ============================================================================
// Types for internal use (from Python retrocast models)
// ============================================================================

interface PythonMolecule {
    smiles: string
    inchikey: string
    synthesis_step: PythonReactionStep | null
    metadata?: Record<string, unknown>
    is_leaf?: boolean
}

interface PythonReactionStep {
    reactants: PythonMolecule[]
    mapped_smiles?: string | null
    template?: string | null
    reagents?: string[] | null
    solvents?: string[] | null
    metadata?: Record<string, unknown>
    is_convergent?: boolean
}

interface PythonRoute {
    target: PythonMolecule
    rank: number
    solvability?: Record<string, boolean>
    metadata?: Record<string, unknown>
}

interface PythonBenchmarkTarget {
    id: string
    smiles: string
    metadata?: Record<string, unknown>
    ground_truth?: PythonRoute | null
    is_convergent?: boolean | null
    route_length?: number | null
}

interface PythonBenchmarkSet {
    name: string
    description?: string
    stock_name?: string | null
    targets: Record<string, PythonBenchmarkTarget>
}

// ============================================================================
// Route Query Functions
// ============================================================================

/**
 * Retrieves a route by ID.
 *
 * @param routeId - The route ID
 * @returns Route data
 * @throws Error if route not found
 */
export async function getRouteById(routeId: string): Promise<Route> {
    const route = await prisma.route.findUnique({
        where: { id: routeId },
    })

    if (!route) {
        throw new Error('Route not found')
    }

    return {
        id: route.id,
        predictionRunId: route.predictionRunId,
        targetId: route.targetId,
        rank: route.rank,
        contentHash: route.contentHash,
        signature: route.signature,
        length: route.length,
        isConvergent: route.isConvergent,
        metadata: route.metadata,
    }
}

/**
 * Recursively builds route node tree for visualization.
 *
 * @param nodeId - Root node ID
 * @returns Complete route node tree
 */
async function buildRouteNodeTree(nodeId: string): Promise<RouteNodeWithDetails> {
    const node = await prisma.routeNode.findUnique({
        where: { id: nodeId },
        include: {
            molecule: true,
            children: true,
        },
    })

    if (!node) {
        throw new Error('Route node not found')
    }

    const childrenTrees = await Promise.all(node.children.map((child) => buildRouteNodeTree(child.id)))

    return {
        id: node.id,
        routeId: node.routeId,
        moleculeId: node.moleculeId,
        parentId: node.parentId,
        isLeaf: node.isLeaf,
        reactionHash: node.reactionHash,
        template: node.template,
        metadata: node.metadata,
        molecule: node.molecule,
        children: childrenTrees,
    }
}

/**
 * Retrieves complete route tree for visualization.
 *
 * @param routeId - The route ID
 * @returns Route with full node tree and target
 * @throws Error if route not found
 */
export async function getRouteTreeData(routeId: string): Promise<RouteVisualizationData> {
    const route = await prisma.route.findUnique({
        where: { id: routeId },
        include: {
            target: {
                include: {
                    molecule: true,
                },
            },
        },
    })

    if (!route) {
        throw new Error('Route not found')
    }

    // Find root node (node with no parent)
    const rootNode = await prisma.routeNode.findFirst({
        where: {
            routeId,
            parentId: null,
        },
    })

    if (!rootNode) {
        throw new Error('Route has no root node')
    }

    // Build tree from root
    const tree = await buildRouteNodeTree(rootNode.id)

    return {
        route: {
            id: route.id,
            predictionRunId: route.predictionRunId,
            targetId: route.targetId,
            rank: route.rank,
            contentHash: route.contentHash,
            signature: route.signature,
            length: route.length,
            isConvergent: route.isConvergent,
            metadata: route.metadata,
        },
        target: {
            id: route.target.id,
            benchmarkSetId: route.target.benchmarkSetId,
            targetId: route.target.targetId,
            moleculeId: route.target.moleculeId,
            routeLength: route.target.routeLength,
            isConvergent: route.target.isConvergent,
            metadata: route.target.metadata,
            groundTruthRouteId: route.target.groundTruthRouteId,
            molecule: route.target.molecule,
            hasGroundTruth: !!route.target.groundTruthRouteId,
        },
        rootNode: tree,
    }
}

/**
 * Retrieves all routes for a target (ground truth + predictions).
 *
 * @param targetId - The benchmark target ID
 * @returns Array of routes ordered by rank
 */
export async function getRoutesByTarget(targetId: string): Promise<Route[]> {
    const routes = await prisma.route.findMany({
        where: { targetId },
        orderBy: { rank: 'asc' },
    })

    return routes.map((route) => ({
        id: route.id,
        predictionRunId: route.predictionRunId,
        targetId: route.targetId,
        rank: route.rank,
        contentHash: route.contentHash,
        signature: route.signature,
        length: route.length,
        isConvergent: route.isConvergent,
        metadata: route.metadata,
    }))
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
 * Recursively stores a route tree in the database.
 * Creates RouteNode records for all molecules in the synthesis tree.
 *
 * @param routeId - The route ID
 * @param molecule - Root molecule (target)
 * @param parentNodeId - Parent node ID (null for root)
 * @returns Root node ID
 */
async function storeRouteTree(
    routeId: string,
    molecule: PythonMolecule,
    parentNodeId: string | null,
    tx: Prisma.TransactionClient
): Promise<{ nodeId: string; leafCount: number; moleculesCreated: number }> {
    // Get or create molecule
    let mol = await tx.molecule.findUnique({
        where: { inchikey: molecule.inchikey },
        select: { id: true },
    })

    let moleculesCreatedInThisCall = 0
    if (!mol) {
        mol = await tx.molecule.create({
            data: {
                smiles: molecule.smiles,
                inchikey: molecule.inchikey,
            },
            select: { id: true },
        })
        moleculesCreatedInThisCall = 1
    }

    // Create route node
    const isLeaf = !molecule.synthesis_step
    const node = await tx.routeNode.create({
        data: {
            routeId,
            moleculeId: mol.id,
            parentId: parentNodeId,
            isLeaf,
            template: molecule.synthesis_step?.template || null,
            metadata: molecule.synthesis_step?.metadata ? JSON.stringify(molecule.synthesis_step.metadata) : null,
        },
        select: { id: true },
    })

    // Recursively store reactants
    let totalLeaves = isLeaf ? 1 : 0
    let totalMoleculesCreated = moleculesCreatedInThisCall
    if (molecule.synthesis_step?.reactants) {
        for (const reactant of molecule.synthesis_step.reactants) {
            const result = await storeRouteTree(routeId, reactant, node.id, tx)
            totalLeaves += result.leafCount
            totalMoleculesCreated += result.moleculesCreated
        }
    }

    return {
        nodeId: node.id,
        leafCount: totalLeaves,
        moleculesCreated: totalMoleculesCreated,
    }
}

/**
 * Computes route length (longest linear path) from route nodes.
 *
 * @param routeId - The route ID
 * @returns Maximum path length
 */
async function computeRouteLength(routeId: string, tx: Prisma.TransactionClient): Promise<number> {
    const rootNode = await tx.routeNode.findFirst({
        where: { routeId, parentId: null },
        select: { id: true },
    })

    if (!rootNode) return 0

    async function getDepth(nodeId: string): Promise<number> {
        const node = await tx.routeNode.findUnique({
            where: { id: nodeId },
            select: { children: true },
        })

        if (!node?.children || node.children.length === 0) {
            return 0
        }

        const childDepths = await Promise.all(node.children.map((child) => getDepth(child.id)))
        return 1 + Math.max(...childDepths)
    }

    return getDepth(rootNode.id)
}

/**
 * Detects convergent reactions in a route.
 *
 * @param routeId - The route ID
 * @returns True if route has convergent reactions
 */
async function computeIsConvergent(routeId: string, tx: Prisma.TransactionClient): Promise<boolean> {
    const nodes = await tx.routeNode.findMany({
        where: { routeId },
        include: { children: true },
    })

    for (const node of nodes) {
        // Count non-leaf children
        const nonLeafChildren = node.children.filter((child) => !child.isLeaf)
        if (nonLeafChildren.length >= 2) {
            return true
        }
    }

    return false
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
    console.log('Parsing benchmark file...')
    const benchmarkData = await parseBenchmarkFile(filePath)

    // Load targets
    const targetIds = Object.keys(benchmarkData.targets)
    console.log(`Loading ${targetIds.length} targets...`)

    let moleculesCreated = 0
    let moleculesReused = 0
    let routesCreated = 0

    const BATCH_SIZE = 10 // Conservative batch size for route parsing

    for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
        const batch = targetIds.slice(i, i + BATCH_SIZE)

        await prisma.$transaction(async (tx) => {
            for (const externalId of batch) {
                const targetData = benchmarkData.targets[externalId]

                // Get or create target molecule
                // For target molecules, we need to get the inchikey from the ground_truth data if available
                let targetInchikey = targetData.smiles // fallback
                if (targetData.ground_truth?.target?.inchikey) {
                    targetInchikey = targetData.ground_truth.target.inchikey
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

                // Create benchmark target first
                const benchmarkTarget = await tx.benchmarkTarget.create({
                    data: {
                        benchmarkSetId: benchmarkId,
                        targetId: externalId,
                        moleculeId: targetMol.id,
                        routeLength: targetData.route_length || null,
                        isConvergent: targetData.is_convergent || null,
                        metadata: targetData.metadata ? JSON.stringify(targetData.metadata) : null,
                        groundTruthRouteId: null, // Will be set if ground truth exists
                    },
                })

                // Create ground truth route if it exists
                if (targetData.ground_truth) {
                    // Create ground truth route
                    const route = await tx.route.create({
                        data: {
                            targetId: benchmarkTarget.id, // Now we have the target ID
                            rank: 1,
                            contentHash: '', // Will be set after route storage
                            length: 0, // Will be computed
                            isConvergent: targetData.is_convergent ?? false,
                            metadata: targetData.metadata ? JSON.stringify(targetData.metadata) : null,
                        },
                        select: { id: true },
                    })

                    // Store route tree
                    const routeResult = await storeRouteTree(route.id, targetData.ground_truth.target, null, tx)
                    moleculesCreated += routeResult.moleculesCreated

                    // Compute route properties
                    const length = await computeRouteLength(route.id, tx)
                    const isConvergent = await computeIsConvergent(route.id, tx)

                    // Update route with computed properties
                    await tx.route.update({
                        where: { id: route.id },
                        data: {
                            length,
                            isConvergent,
                            contentHash: 'computed', // Simplified for now
                        },
                    })

                    // Update benchmark target to link to ground truth route
                    await tx.benchmarkTarget.update({
                        where: { id: benchmarkTarget.id },
                        data: {
                            groundTruthRouteId: route.id,
                        },
                    })

                    routesCreated++
                }
            }
        })

        const processed = Math.min(i + BATCH_SIZE, targetIds.length)
        console.log(`Processed ${processed}/${targetIds.length} targets...`)
    }

    console.log('Benchmark load complete!')

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
