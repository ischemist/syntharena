/**
 * view model composition layer for predictions and routes.
 * rule: this file is FORBIDDEN from importing `prisma`.
 * it consumes functions from `run.data.ts` and `route.data.ts` to build
 * DTOs for the prediction-focused UI components.
 */

import type {
    BenchmarkTargetWithMolecule,
    MetricResult,
    ModelStatistics,
    PredictionRunWithStats,
    ReliabilityCode,
    RouteNodeWithDetails,
    RunStatistics,
    StockListItem,
    StratifiedMetric,
    TargetPredictionDetail,
} from '@/types'
import * as benchmarkData from '@/lib/services/data/benchmark.data'
import * as routeData from '@/lib/services/data/route.data'
import * as runData from '@/lib/services/data/run.data'
import * as statsData from '@/lib/services/data/stats.data'
import { buildRouteTree } from '@/lib/tree-builder/route-tree'

import { toVisualizationNode } from './route.view'

/** prepares the DTO for the main prediction run list page. */
export async function getPredictionRuns(benchmarkId?: string, modelId?: string): Promise<PredictionRunWithStats[]> {
    const runs = await runData.findPredictionRunsForList({
        ...(benchmarkId && { benchmarkSetId: benchmarkId }),
        ...(modelId && { modelInstanceId: modelId }),
    })

    return runs.map((run) => {
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
            modelInstance: run.modelInstance,
            benchmarkSet: run.benchmarkSet,
            totalRoutes: run.totalRoutes,
            hourlyCost: run.hourlyCost,
            totalCost: run.totalCost,
            totalWallTime: run.statistics[0]?.totalWallTime ?? null,
            avgRouteLength: run.avgRouteLength,
            solvabilitySummary,
            executedAt: run.executedAt,
        }
    })
}

/** prepares the DTO for the target detail/comparison page. this is a beast. */
export async function getTargetPredictions(
    targetId: string,
    runId: string,
    stockId?: string
): Promise<TargetPredictionDetail> {
    // parallelize data fetching from different domains
    const [targetPayload, predictionPayload] = await Promise.all([
        benchmarkData.findTargetWithDetailsById(targetId),
        routeData.findPredictionsForTarget(targetId, runId, stockId),
    ])

    const acceptableRoutesRaw = await routeData.findAcceptableRoutesForTarget(targetId)
    const acceptableRoutes = acceptableRoutesRaw.map((ar) => ({
        ...ar.route,
        id: ar.route.id,
        routeIndex: ar.routeIndex,
        // placeholder values until full route is fetched, if needed
        length: -1,
        isConvergent: false,
        signature: ar.route.signature || '',
        contentHash: ar.route.contentHash || '',
    }))

    const routesWithTrees = predictionPayload.map((pr) => {
        const routeTree = buildRouteTree(pr.route.nodes)
        const solvability = pr.solvabilityStatus.map((s) => ({
            stockId: s.stockId,
            stockName: s.stock.name,
            isSolvable: s.isSolvable,
            matchesAcceptable: s.matchesAcceptable,
            matchedAcceptableIndex: s.matchedAcceptableIndex,
        }))

        return {
            route: pr.route,
            predictionRoute: pr,
            routeNode: routeTree,
            visualizationNode: toVisualizationNode(routeTree),
            solvability,
        }
    })

    const acceptableMatchRank = routesWithTrees.find((r) => r.solvability.some((s) => s.matchesAcceptable))
        ?.predictionRoute.rank

    return {
        targetId: targetPayload.targetId,
        molecule: targetPayload.molecule,
        routeLength: targetPayload.routeLength,
        isConvergent: targetPayload.isConvergent,
        hasAcceptableRoutes: targetPayload.acceptableRoutesCount > 0,
        acceptableRoutes,
        acceptableMatchRank,
        routes: routesWithTrees,
    }
}

/** gets a specific predicted route and builds its visualization tree. */
export async function getPredictedRouteForTarget(targetId: string, runId: string, rank: number) {
    const predictionRoute = await routeData.findPredictedRouteForTarget(targetId, runId, rank)
    if (!predictionRoute || predictionRoute.route.nodes.length === 0) {
        return null
    }
    return buildRouteTree(predictionRoute.route.nodes)
}

/** DTO for prediction run summary used in model selectors. */
export interface PredictionRunSummary {
    id: string
    modelName: string
    modelVersion?: string
    algorithmName: string
    executedAt: Date
    routeCount: number
    maxRank: number
}

/** aggregates prediction routes into run summaries for a target. */
export async function getPredictionRunsForTarget(targetId: string): Promise<PredictionRunSummary[]> {
    const predictionRoutes = await routeData.findPredictionRunsForTarget(targetId)

    // aggregate by run ID
    const runMap = new Map<
        string,
        {
            run: (typeof predictionRoutes)[0]['predictionRun']
            ranks: number[]
        }
    >()

    for (const pr of predictionRoutes) {
        const existing = runMap.get(pr.predictionRun.id)
        if (existing) {
            existing.ranks.push(pr.rank)
        } else {
            runMap.set(pr.predictionRun.id, { run: pr.predictionRun, ranks: [pr.rank] })
        }
    }

    return Array.from(runMap.values()).map(({ run, ranks }) => ({
        id: run.id,
        modelName: run.modelInstance.name,
        modelVersion: run.modelInstance.version || undefined,
        algorithmName: run.modelInstance.algorithm.name,
        executedAt: run.executedAt,
        routeCount: ranks.length,
        maxRank: Math.max(...ranks),
    }))
}

// ============================================================================
// Run Detail Page Functions
// ============================================================================

/** prepares the DTO for a single prediction run detail page. */
export async function getPredictionRunById(runId: string): Promise<PredictionRunWithStats> {
    const run = await runData.findPredictionRunDetailsById(runId)

    // Calculate solvability summary across stocks
    const solvabilitySummary: Record<string, number> = {}
    for (const stat of run.statistics) {
        const overallMetric = stat.metrics.find((m) => m.metricName === 'Solvability' && m.groupKey === null)
        if (overallMetric) {
            solvabilitySummary[stat.stockId] = overallMetric.value
        }
    }

    // Extract totalWallTime from first statistics record
    const totalWallTime = run.statistics[0]?.totalWallTime ?? null

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
            hasAcceptableRoutes: run.benchmarkSet.hasAcceptableRoutes,
        },
        totalRoutes: run.totalRoutes,
        hourlyCost: run.hourlyCost,
        totalCost: run.totalCost,
        totalWallTime,
        avgRouteLength: run.avgRouteLength,
        solvabilitySummary,
        executedAt: run.executedAt,
    }
}

/** returns stocks that have statistics computed for a run. */
export async function getStocksForRun(runId: string): Promise<StockListItem[]> {
    const statsWithStocks = await statsData.findStocksWithStatsForRun(runId)
    return statsWithStocks.map((stat) => ({
        id: stat.stock.id,
        name: stat.stock.name,
        description: stat.stock.description || undefined,
        itemCount: stat.stock._count.items,
    }))
}

/** returns ordered list of target IDs for a run's benchmark. */
export async function getTargetIdsByRun(runId: string, routeLength?: number): Promise<string[]> {
    const run = await runData.findPredictionRunDetailsById(runId)
    return benchmarkData.findTargetIdsByBenchmark(run.benchmarkSetId, routeLength)
}

/** returns distinct route lengths available for filtering. */
export async function getAvailableRouteLengths(runId: string): Promise<number[]> {
    const run = await runData.findPredictionRunDetailsById(runId)
    if (!run.benchmarkSet.hasAcceptableRoutes) {
        return []
    }
    return benchmarkData.findAvailableRouteLengths(run.benchmarkSetId)
}

/** returns full statistics for a run against a stock. */
export async function getRunStatistics(runId: string, stockId: string): Promise<RunStatistics> {
    const stats = await statsData.findStatisticsForRun(runId, stockId)

    // Parse statistics JSON
    let parsedStats: ModelStatistics | undefined
    try {
        parsedStats = JSON.parse(stats.statisticsJson) as ModelStatistics
    } catch (error) {
        console.error('Failed to parse statistics JSON:', error)
    }

    // Fallback: reconstruct from metrics table
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
// Target Search Functions
// ============================================================================

/** searches targets within a run's benchmark by targetId or SMILES. */
export async function searchTargets(
    runId: string,
    query: string,
    stockId?: string,
    routeLength?: number,
    limit: number = 20
): Promise<BenchmarkTargetWithMolecule[]> {
    const run = await runData.findPredictionRunDetailsById(runId)
    const benchmarkId = run.benchmarkSetId

    // Use the benchmark view's getBenchmarkTargets with search
    const searchType = 'all' as const
    const result = await import('./benchmark.view').then((mod) =>
        mod.getBenchmarkTargets(
            benchmarkId,
            1, // page
            limit,
            query || undefined, // searchQuery
            searchType,
            undefined, // hasGroundTruth
            routeLength, // minRouteLength
            routeLength, // maxRouteLength (same as min for exact match)
            undefined // isConvergent
        )
    )

    return result.targets
}

// ============================================================================
// Route Tree Functions
// ============================================================================

/** fetches acceptable route with full node tree built. */
export async function getAcceptableRouteWithNodes(routeId: string): Promise<RouteNodeWithDetails | null> {
    try {
        const nodes = await routeData.findNodesForRoute(routeId)
        if (nodes.length === 0) {
            return null
        }
        return buildRouteTree(nodes)
    } catch (error) {
        console.error('Failed to fetch acceptable route:', error)
        return null
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
