import { Prisma } from '@prisma/client'

import type {
    BenchmarkListItem,
    BenchmarkSet,
    BenchmarkStats,
    BenchmarkTargetSearchResult,
    BenchmarkTargetWithMolecule,
} from '@/types'
import prisma from '@/lib/db'

// ============================================================================
// Benchmark Management Functions (CRUD)
// ============================================================================

/**
 * Creates a new empty benchmark set.
 *
 * @param name - Unique benchmark name
 * @param description - Optional description
 * @param stockName - Optional reference stock name
 * @returns Created benchmark
 * @throws Error if name already exists
 */
export async function createBenchmark(name: string, description?: string, stockName?: string): Promise<BenchmarkSet> {
    try {
        return await prisma.benchmarkSet.create({
            data: {
                name,
                description: description || null,
                stockName: stockName || null,
            },
        })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new Error(`A benchmark with name "${name}" already exists.`)
        }
        throw error
    }
}

/**
 * Retrieves all benchmark sets with target counts.
 *
 * @returns Array of benchmarks with targetCount
 */
export async function getBenchmarkSets(): Promise<BenchmarkListItem[]> {
    const benchmarks = await prisma.benchmarkSet.findMany({
        include: {
            _count: {
                select: { targets: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    })

    return benchmarks.map((benchmark) => ({
        id: benchmark.id,
        name: benchmark.name,
        description: benchmark.description || undefined,
        stockName: benchmark.stockName || undefined,
        createdAt: benchmark.createdAt,
        targetCount: benchmark._count.targets,
    }))
}

/**
 * Retrieves a single benchmark by ID with target count.
 *
 * @param benchmarkId - The benchmark ID
 * @returns Benchmark with targetCount
 * @throws Error if benchmark not found
 */
export async function getBenchmarkById(benchmarkId: string): Promise<BenchmarkListItem> {
    const benchmark = await prisma.benchmarkSet.findUnique({
        where: { id: benchmarkId },
        include: {
            _count: {
                select: { targets: true },
            },
        },
    })

    if (!benchmark) {
        throw new Error('Benchmark not found')
    }

    return {
        id: benchmark.id,
        name: benchmark.name,
        description: benchmark.description || undefined,
        stockName: benchmark.stockName || undefined,
        createdAt: benchmark.createdAt,
        targetCount: benchmark._count.targets,
    }
}

/**
 * Deletes a benchmark and all its targets and routes.
 *
 * @param benchmarkId - The benchmark ID
 * @throws Error if benchmark not found
 */
export async function deleteBenchmark(benchmarkId: string): Promise<void> {
    const benchmark = await prisma.benchmarkSet.findUnique({
        where: { id: benchmarkId },
        select: { id: true },
    })

    if (!benchmark) {
        throw new Error('Benchmark not found')
    }

    // Delete in transaction (cascade relations)
    // Note: PredictionRoutes and RouteSolvability will cascade delete due to onDelete: Cascade
    await prisma.$transaction([
        // Delete prediction routes for this benchmark's targets
        prisma.predictionRoute.deleteMany({
            where: {
                target: {
                    benchmarkSetId: benchmarkId,
                },
            },
        }),
        // Delete prediction runs for this benchmark
        prisma.predictionRun.deleteMany({
            where: { benchmarkSetId: benchmarkId },
        }),
        // Note: Route nodes and Routes may still be referenced by other predictions
        // Only delete routes that are ONLY used as ground truth for this benchmark
        // This is complex - for now, leave orphaned routes (they'll be cleaned up separately)
        // Delete benchmark targets
        prisma.benchmarkTarget.deleteMany({
            where: { benchmarkSetId: benchmarkId },
        }),
        // Delete benchmark
        prisma.benchmarkSet.delete({
            where: { id: benchmarkId },
        }),
    ])
}

// ============================================================================
// Target Query Functions
// ============================================================================

/**
 * Retrieves targets for a benchmark with pagination and search/filter support.
 *
 * @param benchmarkId - The benchmark ID
 * @param page - Page number (1-indexed)
 * @param limit - Number of results per page
 * @param searchQuery - Search text for SMILES, InChiKey, or Target ID
 * @param searchType - Type of search ('smiles' | 'inchikey' | 'targetId' | 'all')
 * @param hasGroundTruth - Filter by ground truth availability
 * @param minRouteLength - Filter by minimum route length
 * @param maxRouteLength - Filter by maximum route length
 * @param isConvergent - Filter by convergence
 * @returns Paginated targets with molecules
 * @throws Error if benchmark not found
 */
export async function getBenchmarkTargets(
    benchmarkId: string,
    page: number = 1,
    limit: number = 24,
    searchQuery?: string,
    searchType: 'smiles' | 'inchikey' | 'targetId' | 'all' = 'all',
    hasGroundTruth?: boolean,
    minRouteLength?: number,
    maxRouteLength?: number,
    isConvergent?: boolean
): Promise<BenchmarkTargetSearchResult> {
    // Verify benchmark exists
    const benchmark = await prisma.benchmarkSet.findUnique({
        where: { id: benchmarkId },
        select: { id: true },
    })

    if (!benchmark) {
        throw new Error('Benchmark not found')
    }

    const validPage = Math.max(1, page)
    const validLimit = Math.min(Math.max(1, limit), 100)
    const offset = (validPage - 1) * validLimit

    // Build where clause
    const where: Prisma.BenchmarkTargetWhereInput = {
        benchmarkSetId: benchmarkId,
    }

    // Add search filters
    if (searchQuery && searchQuery.trim()) {
        const query = searchQuery.trim()
        const searchConditions: Prisma.BenchmarkTargetWhereInput[] = []

        if (searchType === 'smiles' || searchType === 'all') {
            searchConditions.push({
                molecule: {
                    smiles: { contains: query },
                },
            })
        }

        if (searchType === 'inchikey' || searchType === 'all') {
            searchConditions.push({
                molecule: {
                    inchikey: { contains: query },
                },
            })
        }

        if (searchType === 'targetId' || searchType === 'all') {
            searchConditions.push({
                targetId: { contains: query },
            })
        }

        if (searchConditions.length > 0) {
            where.OR = searchConditions
        }
    }

    if (hasGroundTruth !== undefined) {
        if (hasGroundTruth) {
            where.groundTruthRouteId = { not: null }
        } else {
            where.groundTruthRouteId = null
        }
    }

    if (minRouteLength !== undefined || maxRouteLength !== undefined) {
        const routeLengthFilter: Prisma.IntFilter = {}
        if (minRouteLength !== undefined) {
            routeLengthFilter.gte = minRouteLength
        }
        if (maxRouteLength !== undefined) {
            routeLengthFilter.lte = maxRouteLength
        }
        where.routeLength = routeLengthFilter
    }

    if (isConvergent !== undefined) {
        where.isConvergent = isConvergent
    }

    // Execute query
    const [targets, total] = await Promise.all([
        prisma.benchmarkTarget.findMany({
            where,
            include: {
                molecule: true,
            },
            orderBy: { targetId: 'asc' },
            take: validLimit + 1,
            skip: offset,
        }),
        prisma.benchmarkTarget.count({ where }),
    ])

    const hasMore = targets.length > validLimit
    const resultTargets = hasMore ? targets.slice(0, validLimit) : targets

    return {
        targets: resultTargets.map((target) => ({
            id: target.id,
            benchmarkSetId: target.benchmarkSetId,
            targetId: target.targetId,
            moleculeId: target.moleculeId,
            routeLength: target.routeLength,
            isConvergent: target.isConvergent,
            metadata: target.metadata,
            groundTruthRouteId: target.groundTruthRouteId,
            molecule: target.molecule,
            hasGroundTruth: !!target.groundTruthRouteId,
        })),
        total,
        hasMore,
        page: validPage,
        limit: validLimit,
    }
}

/**
 * Retrieves a single benchmark target with molecule and routes.
 *
 * @param targetId - The benchmark target ID
 * @returns Target with molecule and route info
 * @throws Error if target not found
 */
export async function getTargetById(targetId: string): Promise<BenchmarkTargetWithMolecule> {
    const target = await prisma.benchmarkTarget.findUnique({
        where: { id: targetId },
        include: {
            molecule: true,
        },
    })

    if (!target) {
        throw new Error('Benchmark target not found')
    }

    return {
        id: target.id,
        benchmarkSetId: target.benchmarkSetId,
        targetId: target.targetId,
        moleculeId: target.moleculeId,
        routeLength: target.routeLength,
        isConvergent: target.isConvergent,
        metadata: target.metadata,
        groundTruthRouteId: target.groundTruthRouteId,
        molecule: target.molecule,
        hasGroundTruth: !!target.groundTruthRouteId,
    }
}

// ============================================================================
// Statistics Functions
// ============================================================================

/**
 * Computes statistics for a benchmark set.
 *
 * @param benchmarkId - The benchmark ID
 * @returns Statistics object
 * @throws Error if benchmark not found
 */
export async function getBenchmarkStats(benchmarkId: string): Promise<BenchmarkStats> {
    const benchmark = await prisma.benchmarkSet.findUnique({
        where: { id: benchmarkId },
    })

    if (!benchmark) {
        throw new Error('Benchmark not found')
    }

    const targets = await prisma.benchmarkTarget.findMany({
        where: { benchmarkSetId: benchmarkId },
        select: {
            routeLength: true,
            isConvergent: true,
            groundTruthRouteId: true,
        },
    })

    const routeLengths = targets.filter((t) => t.routeLength !== null).map((t) => t.routeLength as number)

    return {
        totalTargets: targets.length,
        targetsWithGroundTruth: targets.filter((t) => t.groundTruthRouteId).length,
        avgRouteLength: routeLengths.length > 0 ? routeLengths.reduce((a, b) => a + b, 0) / routeLengths.length : 0,
        convergentRoutes: targets.filter((t) => t.isConvergent).length,
        minRouteLength: routeLengths.length > 0 ? Math.min(...routeLengths) : 0,
        maxRouteLength: routeLengths.length > 0 ? Math.max(...routeLengths) : 0,
    }
}

// ============================================================================
// Prediction Run Functions
// ============================================================================

/**
 * Get all prediction runs for a benchmark set.
 * Used to populate model selector dropdowns.
 *
 * @param benchmarkId - The benchmark ID
 * @returns Array of prediction runs with model info
 * @throws Error if benchmark not found
 */
export async function getPredictionRunsForBenchmark(benchmarkId: string) {
    // Verify benchmark exists
    const benchmark = await prisma.benchmarkSet.findUnique({
        where: { id: benchmarkId },
        select: { id: true },
    })

    if (!benchmark) {
        throw new Error('Benchmark not found')
    }

    const runs = await prisma.predictionRun.findMany({
        where: { benchmarkSetId: benchmarkId },
        include: {
            modelInstance: {
                include: {
                    algorithm: true,
                },
            },
        },
        orderBy: {
            executedAt: 'desc',
        },
    })

    return runs.map((run) => ({
        id: run.id,
        modelName: run.modelInstance.name,
        modelVersion: run.modelInstance.version || undefined,
        algorithmName: run.modelInstance.algorithm.name,
        executedAt: run.executedAt,
        totalRoutes: run.totalRoutes,
        avgRouteLength: run.avgRouteLength || undefined,
    }))
}

/**
 * Get all prediction runs that have predictions for a specific target.
 * Returns runs with route counts and max ranks specific to this target.
 *
 * @param targetId - The benchmark target ID
 * @returns Array of prediction runs with target-specific route info
 */
export async function getPredictionRunsForTarget(targetId: string) {
    // Verify target exists
    const target = await prisma.benchmarkTarget.findUnique({
        where: { id: targetId },
        select: { id: true },
    })

    if (!target) {
        throw new Error('Benchmark target not found')
    }

    // Get all prediction routes for this target
    const predictionRoutes = await prisma.predictionRoute.findMany({
        where: {
            targetId,
        },
        select: {
            predictionRunId: true,
            rank: true,
            predictionRun: {
                include: {
                    modelInstance: {
                        include: {
                            algorithm: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            rank: 'asc',
        },
    })

    // Group by run and compute max rank + route count
    const runMap = new Map<
        string,
        {
            id: string
            modelName: string
            modelVersion?: string
            algorithmName: string
            executedAt: Date
            routeCount: number
            maxRank: number
        }
    >()

    for (const predictionRoute of predictionRoutes) {
        const runId = predictionRoute.predictionRunId
        const existing = runMap.get(runId)

        if (!existing) {
            runMap.set(runId, {
                id: predictionRoute.predictionRun.id,
                modelName: predictionRoute.predictionRun.modelInstance.name,
                modelVersion: predictionRoute.predictionRun.modelInstance.version || undefined,
                algorithmName: predictionRoute.predictionRun.modelInstance.algorithm.name,
                executedAt: predictionRoute.predictionRun.executedAt,
                routeCount: 1,
                maxRank: predictionRoute.rank,
            })
        } else {
            existing.routeCount++
            existing.maxRank = Math.max(existing.maxRank, predictionRoute.rank)
        }
    }

    // Convert to array and sort by execution date (most recent first)
    return Array.from(runMap.values()).sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime())
}

/**
 * Get a specific predicted route for a target from a prediction run.
 * Returns the route tree structure for visualization.
 *
 * @param targetId - The benchmark target ID (internal ID, not targetId string)
 * @param runId - The prediction run ID
 * @param rank - The route rank (1-indexed)
 * @returns Route tree with molecule details, or null if not found
 */
export async function getPredictedRouteForTarget(targetId: string, runId: string, rank: number) {
    // Import route tree builder
    const { buildRouteTree } = await import('./route-tree-builder')

    // Fetch the prediction route
    const predictionRoute = await prisma.predictionRoute.findFirst({
        where: {
            targetId,
            predictionRunId: runId,
            rank,
        },
        include: {
            route: {
                include: {
                    nodes: {
                        include: {
                            molecule: true,
                        },
                    },
                },
            },
        },
    })

    if (!predictionRoute) {
        return null
    }

    // Build route tree from nodes
    if (predictionRoute.route.nodes.length === 0) {
        return null
    }

    return buildRouteTree(predictionRoute.route.nodes)
}
