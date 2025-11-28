/**
 * Prediction Service - Read Operations
 *
 * Provides query functions for retrieving model predictions, routes, and statistics.
 * Used by UI components to display prediction data.
 */

import { Prisma } from '@prisma/client'

import type {
    BenchmarkTargetSearchResult,
    BenchmarkTargetWithMolecule,
    MetricResult,
    ModelStatistics,
    PredictionRunWithStats,
    ReliabilityCode,
    RunStatistics,
    StockListItem,
    StratifiedMetric,
    TargetPredictionDetail,
} from '@/types'
import prisma from '@/lib/db'

import { buildRouteTree } from './route-tree-builder'

// ============================================================================
// Core Read Functions
// ============================================================================

/**
 * List all prediction runs with optional filters.
 *
 * @param benchmarkId - Optional: Filter runs by benchmark
 * @param modelId - Optional: Filter runs by model instance
 * @returns Array of prediction runs with statistics summary
 */
export async function getPredictionRuns(benchmarkId?: string, modelId?: string): Promise<PredictionRunWithStats[]> {
    const runs = await prisma.predictionRun.findMany({
        where: {
            ...(benchmarkId && { benchmarkSetId: benchmarkId }),
            ...(modelId && { modelInstanceId: modelId }),
        },
        include: {
            modelInstance: {
                include: {
                    algorithm: true,
                },
            },
            benchmarkSet: true,
            statistics: {
                include: {
                    stock: true,
                    metrics: {
                        where: {
                            metricName: 'Solvability',
                            groupKey: null, // Only overall solvability
                        },
                    },
                },
            },
        },
        orderBy: {
            executedAt: 'desc',
        },
    })

    return runs.map((run) => {
        // Calculate solvability summary across stocks
        const solvabilitySummary: Record<string, number> = {}
        for (const stat of run.statistics) {
            const overallMetric = stat.metrics[0]
            if (overallMetric) {
                solvabilitySummary[stat.stockId] = overallMetric.value
            }
        }

        return {
            id: run.id,
            modelInstanceId: run.modelInstanceId,
            benchmarkSetId: run.benchmarkSetId,
            modelInstance: {
                id: run.modelInstance.id,
                algorithmId: run.modelInstance.algorithmId,
                name: run.modelInstance.name,
                version: run.modelInstance.version,
                metadata: run.modelInstance.metadata,
                algorithm: run.modelInstance.algorithm
                    ? {
                          id: run.modelInstance.algorithm.id,
                          name: run.modelInstance.algorithm.name,
                          paper: run.modelInstance.algorithm.paper,
                      }
                    : undefined,
            },
            benchmarkSet: {
                ...run.benchmarkSet,
                hasGroundTruth: run.benchmarkSet.hasGroundTruth,
            },
            totalRoutes: run.totalRoutes,
            totalTimeMs: run.totalTimeMs,
            avgRouteLength: run.avgRouteLength,
            solvabilitySummary,
            executedAt: run.executedAt,
        }
    })
}

/**
 * Get full run details by ID.
 *
 * @param runId - The prediction run ID
 * @returns Prediction run with model, benchmark, and statistics
 * @throws Error if run not found
 */
export async function getPredictionRunById(runId: string) {
    const run = await prisma.predictionRun.findUnique({
        where: { id: runId },
        include: {
            modelInstance: {
                include: {
                    algorithm: true,
                },
            },
            benchmarkSet: true,
            statistics: {
                include: {
                    stock: true,
                    metrics: true,
                },
            },
        },
    })

    if (!run) {
        throw new Error('Prediction run not found.')
    }

    return run
}

/**
 * Get all predicted routes for a target with optional stock filtering.
 *
 * @param targetId - The benchmark target ID
 * @param runId - The prediction run ID
 * @param stockId - Optional: Stock ID for solvability filtering
 * @returns Target prediction detail with routes and GT comparison
 * @throws Error if target or run not found
 */
export async function getTargetPredictions(
    targetId: string,
    runId: string,
    stockId?: string
): Promise<TargetPredictionDetail> {
    // Fetch target with molecule and ground truth
    const target = await prisma.benchmarkTarget.findUnique({
        where: { id: targetId },
        include: {
            molecule: true,
            groundTruthRoute: true,
        },
    })

    if (!target) {
        throw new Error('Target not found.')
    }

    // Fetch all predictions for this target in this run
    const predictionRoutes = await prisma.predictionRoute.findMany({
        where: {
            targetId,
            predictionRunId: runId,
        },
        include: {
            route: {
                include: {
                    nodes: {
                        include: {
                            molecule: true,
                            children: {
                                include: {
                                    molecule: true,
                                },
                            },
                        },
                    },
                },
            },
            solvabilityStatus: {
                include: {
                    stock: true,
                },
                ...(stockId && { where: { stockId } }),
            },
        },
        orderBy: {
            rank: 'asc',
        },
    })

    // Build route node tree for each prediction
    const routesWithTrees = predictionRoutes.map((predictionRoute) => {
        // Build hierarchical tree from flat node array
        const routeTree = buildRouteTree(predictionRoute.route.nodes)

        // Map solvability status
        const solvability = predictionRoute.solvabilityStatus.map((s) => ({
            stockId: s.stockId,
            stockName: s.stock.name,
            isSolvable: s.isSolvable,
            isGtMatch: s.isGtMatch,
        }))

        return {
            route: predictionRoute.route,
            predictionRoute: {
                id: predictionRoute.id,
                routeId: predictionRoute.routeId,
                predictionRunId: predictionRoute.predictionRunId,
                targetId: predictionRoute.targetId,
                rank: predictionRoute.rank,
                metadata: predictionRoute.metadata,
            },
            routeNode: routeTree,
            solvability,
        }
    })

    // Check for GT match
    const groundTruthRank = routesWithTrees.find((r) => r.solvability.some((s) => s.isGtMatch))?.predictionRoute.rank

    return {
        targetId: target.targetId,
        molecule: target.molecule,
        routeLength: target.routeLength,
        isConvergent: target.isConvergent,
        hasGroundTruth: !!target.groundTruthRouteId,
        groundTruthRoute: target.groundTruthRoute || undefined,
        groundTruthRank,
        routes: routesWithTrees,
    }
}

/**
 * Search targets for a prediction run by targetId or SMILES.
 * If query is empty, returns the first N targets ordered by targetId.
 *
 * @param runId - The prediction run ID
 * @param query - Search query (matches targetId or SMILES substring). Empty string returns initial targets.
 * @param stockId - Optional: Stock ID to include in route data
 * @param limit - Maximum number of results (default: 20)
 * @returns Array of matching targets with molecule data
 * @throws Error if run not found
 */
export async function searchTargets(
    runId: string,
    query: string,
    stockId?: string,
    limit = 20
): Promise<BenchmarkTargetWithMolecule[]> {
    // Verify run exists and get benchmark ID
    const run = await prisma.predictionRun.findUnique({
        where: { id: runId },
        select: { benchmarkSetId: true },
    })

    if (!run) {
        throw new Error('Prediction run not found.')
    }

    // Trim and lowercase query for case-insensitive matching
    const searchQuery = query.trim().toLowerCase()

    // Build where clause - if query is empty, show all targets (limited by take)
    const where: Prisma.BenchmarkTargetWhereInput = {
        benchmarkSetId: run.benchmarkSetId,
        ...(searchQuery && {
            OR: [
                {
                    targetId: {
                        contains: searchQuery,
                    },
                },
                {
                    molecule: {
                        smiles: {
                            contains: searchQuery,
                        },
                    },
                },
            ],
        }),
    }

    // Search by targetId or SMILES substring
    const targets = await prisma.benchmarkTarget.findMany({
        where,
        include: {
            molecule: true,
            predictionRoutes: {
                where: {
                    predictionRunId: runId,
                },
                include: {
                    solvabilityStatus: {
                        ...(stockId && { where: { stockId } }),
                    },
                },
                orderBy: {
                    rank: 'asc',
                },
            },
        },
        take: limit,
        orderBy: {
            targetId: 'asc',
        },
    })

    return targets.map((t) => ({
        ...t,
        molecule: t.molecule,
        hasGroundTruth: !!t.groundTruthRouteId,
        routeCount: t.predictionRoutes.length,
    }))
}

/**
 * Get paginated targets for a prediction run with filters.
 *
 * @param runId - The prediction run ID
 * @param filters - Search and filter parameters
 * @returns Paginated benchmark target search results
 * @throws Error if run not found
 */
export async function getTargetsByRun(
    runId: string,
    filters: {
        page?: number
        limit?: number
        hasGroundTruth?: boolean
        hasSolvedRoute?: boolean
        gtRank?: 'found' | 'not-found'
        minRouteLength?: number
        maxRouteLength?: number
        stockId?: string
    }
): Promise<BenchmarkTargetSearchResult> {
    const {
        page = 1,
        limit = 50,
        hasGroundTruth,
        hasSolvedRoute,
        gtRank,
        minRouteLength,
        maxRouteLength,
        stockId,
    } = filters

    // Verify run exists
    const run = await prisma.predictionRun.findUnique({
        where: { id: runId },
        select: { benchmarkSetId: true },
    })

    if (!run) {
        throw new Error('Prediction run not found.')
    }

    // Build where clause
    const where: Prisma.BenchmarkTargetWhereInput = {
        benchmarkSetId: run.benchmarkSetId,
        // Filter by ground truth availability
        ...(hasGroundTruth !== undefined && {
            groundTruthRouteId: hasGroundTruth ? { not: null } : null,
        }),
        // Filter by route length
        ...(minRouteLength !== undefined && {
            routeLength: { gte: minRouteLength },
        }),
        ...(maxRouteLength !== undefined && {
            routeLength: { lte: maxRouteLength },
        }),
    }

    // Complex filters require joins
    if (hasSolvedRoute !== undefined || gtRank !== undefined) {
        // Need to filter by routes
        where.predictionRoutes = {
            some: {
                predictionRunId: runId,
                ...(hasSolvedRoute !== undefined &&
                    stockId && {
                        solvabilityStatus: {
                            some: {
                                stockId,
                                isSolvable: hasSolvedRoute,
                            },
                        },
                    }),
                ...(gtRank !== undefined &&
                    stockId && {
                        solvabilityStatus: {
                            some: {
                                stockId,
                                isGtMatch: gtRank === 'found',
                            },
                        },
                    }),
            },
        }
    }

    // Count total
    const total = await prisma.benchmarkTarget.count({ where })

    // Fetch paginated results
    const targets = await prisma.benchmarkTarget.findMany({
        where,
        include: {
            molecule: true,
            predictionRoutes: {
                where: {
                    predictionRunId: runId,
                },
                include: {
                    solvabilityStatus: {
                        ...(stockId && { where: { stockId } }),
                        include: {
                            stock: true,
                        },
                    },
                },
                orderBy: {
                    rank: 'asc',
                },
                take: 10, // Limit routes per target for list view
            },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
            targetId: 'asc',
        },
    })

    const targetsWithMolecule: BenchmarkTargetWithMolecule[] = targets.map((t) => ({
        ...t,
        hasGroundTruth: !!t.groundTruthRouteId,
        routeCount: t.predictionRoutes.length,
    }))

    return {
        targets: targetsWithMolecule,
        total,
        hasMore: total > page * limit,
        page,
        limit,
    }
}

/**
 * Get ordered list of target IDs for a prediction run.
 * Used for navigation through targets in sequence.
 * Returns ALL targets from the benchmark set, regardless of whether
 * the model found routes for them or not.
 *
 * @param runId - The prediction run ID
 * @param stockId - Optional: Not used, kept for API compatibility
 * @returns Array of target IDs in alphabetical order
 * @throws Error if run not found
 */
export async function getTargetIdsByRun(runId: string): Promise<string[]> {
    // Verify run exists and get benchmark ID
    const run = await prisma.predictionRun.findUnique({
        where: { id: runId },
        select: { benchmarkSetId: true },
    })

    if (!run) {
        throw new Error('Prediction run not found.')
    }

    // Get ALL target IDs for this benchmark set, ordered alphabetically
    // This includes targets for which the model found no routes
    const targets = await prisma.benchmarkTarget.findMany({
        where: {
            benchmarkSetId: run.benchmarkSetId,
        },
        select: {
            id: true,
        },
        orderBy: {
            targetId: 'asc',
        },
    })

    return targets.map((t) => t.id)
}

/**
 * Get all stocks that have been evaluated for a specific prediction run.
 * Returns only stocks with computed statistics.
 *
 * @param runId - The prediction run ID
 * @returns Array of stocks with evaluation data for this run
 */
export async function getStocksForRun(runId: string): Promise<StockListItem[]> {
    const statistics = await prisma.modelRunStatistics.findMany({
        where: {
            predictionRunId: runId,
        },
        include: {
            stock: {
                include: {
                    _count: {
                        select: { items: true },
                    },
                },
            },
        },
        orderBy: {
            stock: {
                name: 'asc',
            },
        },
    })

    return statistics.map((stat) => ({
        id: stat.stock.id,
        name: stat.stock.name,
        description: stat.stock.description || undefined,
        itemCount: stat.stock._count.items,
    }))
}

/**
 * Get statistical results for a prediction run against a stock.
 *
 * @param runId - The prediction run ID
 * @param stockId - The stock ID
 * @returns Model statistics parsed from JSON
 * @throws Error if statistics not found
 */
export async function getRunStatistics(runId: string, stockId: string): Promise<RunStatistics> {
    const stats = await prisma.modelRunStatistics.findUnique({
        where: {
            predictionRunId_stockId: {
                predictionRunId: runId,
                stockId,
            },
        },
        include: {
            stock: true,
            metrics: true,
        },
    })

    if (!stats) {
        throw new Error('Statistics not found for this run and stock combination.')
    }

    // Parse statistics JSON
    let parsedStats: ModelStatistics | undefined
    try {
        parsedStats = JSON.parse(stats.statisticsJson) as ModelStatistics
    } catch (error) {
        console.error('Failed to parse statistics JSON:', error)
    }

    // Alternatively, reconstruct from metrics table
    if (!parsedStats) {
        parsedStats = reconstructStatisticsFromMetrics(stats.metrics)
    }

    return {
        id: stats.id,
        predictionRunId: stats.predictionRunId,
        stockId: stats.stockId,
        stock: {
            id: stats.stock.id,
            name: stats.stock.name,
            description: stats.stock.description ?? undefined,
        },
        statisticsJson: stats.statisticsJson,
        statistics: parsedStats,
        computedAt: stats.computedAt,
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Reconstruct ModelStatistics from StratifiedMetricGroup records.
 * Fallback for when JSON parsing fails.
 */
function reconstructStatisticsFromMetrics(
    metrics: Array<{
        metricName: string
        groupKey: number | null
        value: number
        ciLower: number
        ciUpper: number
        nSamples: number
        reliabilityCode: string
        reliabilityMessage: string
    }>
): ModelStatistics {
    const solvabilityMetrics = metrics.filter((m) => m.metricName === 'Solvability')
    const topKMetrics = metrics.filter((m) => m.metricName.startsWith('Top-'))

    // Build solvability stratified metric
    const solvabilityOverall = solvabilityMetrics.find((m) => m.groupKey === null)
    const solvabilityByGroup: Record<number, MetricResult> = {}

    for (const metric of solvabilityMetrics.filter((m) => m.groupKey !== null)) {
        solvabilityByGroup[metric.groupKey!] = {
            value: metric.value,
            ciLower: metric.ciLower,
            ciUpper: metric.ciUpper,
            nSamples: metric.nSamples,
            reliability: {
                code: metric.reliabilityCode as ReliabilityCode,
                message: metric.reliabilityMessage,
            },
        }
    }

    const solvability: StratifiedMetric = {
        metricName: 'Solvability',
        overall: solvabilityOverall
            ? {
                  value: solvabilityOverall.value,
                  ciLower: solvabilityOverall.ciLower,
                  ciUpper: solvabilityOverall.ciUpper,
                  nSamples: solvabilityOverall.nSamples,
                  reliability: {
                      code: solvabilityOverall.reliabilityCode as ReliabilityCode,
                      message: solvabilityOverall.reliabilityMessage,
                  },
              }
            : {
                  value: 0,
                  ciLower: 0,
                  ciUpper: 0,
                  nSamples: 0,
                  reliability: { code: 'LOW_N', message: 'No data' },
              },
        byGroup: solvabilityByGroup,
    }

    // Build top-k accuracy metrics
    const topKAccuracy: Record<string, StratifiedMetric> = {}
    const topKNames = [...new Set(topKMetrics.map((m) => m.metricName))]

    for (const metricName of topKNames) {
        const metricsForK = topKMetrics.filter((m) => m.metricName === metricName)
        const overall = metricsForK.find((m) => m.groupKey === null)
        const byGroup: Record<number, MetricResult> = {}

        for (const metric of metricsForK.filter((m) => m.groupKey !== null)) {
            byGroup[metric.groupKey!] = {
                value: metric.value,
                ciLower: metric.ciLower,
                ciUpper: metric.ciUpper,
                nSamples: metric.nSamples,
                reliability: {
                    code: metric.reliabilityCode as ReliabilityCode,
                    message: metric.reliabilityMessage,
                },
            }
        }

        if (overall) {
            topKAccuracy[metricName] = {
                metricName,
                overall: {
                    value: overall.value,
                    ciLower: overall.ciLower,
                    ciUpper: overall.ciUpper,
                    nSamples: overall.nSamples,
                    reliability: {
                        code: overall.reliabilityCode as ReliabilityCode,
                        message: overall.reliabilityMessage,
                    },
                },
                byGroup,
            }
        }
    }

    return {
        solvability,
        ...(Object.keys(topKAccuracy).length > 0 && { topKAccuracy }),
    }
}
