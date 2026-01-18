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
    TargetDisplayData,
    TargetInfo,
    RouteVisualizationNode,
    BuyableMetadata,
} from '@/types'
import { getAllRouteInchiKeysSet } from '@/lib/route-visualization'
import * as benchmarkData from '@/lib/services/data/benchmark.data'
import * as routeData from '@/lib/services/data/route.data'
import * as runData from '@/lib/services/data/run.data'
import * as statsData from '@/lib/services/data/stats.data'
import * as stockData from '@/lib/services/data/stock.data'
import * as predictionData from '@/lib/services/data/prediction.data'
import { buildRouteTree } from '@/lib/tree-builder/route-tree'

import { toVisualizationNode } from './route.view'

/** prepares the DTO for the main prediction run list page. */
export async function getPredictionRuns(benchmarkId?: string, modelId?: string): Promise<PredictionRunWithStats[]> {
    const runs = await runData.findPredictionRunsForList({
        benchmarkSet: {
            isListed: true,
            ...(benchmarkId && { id: benchmarkId }),
        },
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
            submissionType: run.submissionType,
            isRetrained: run.isRetrained,
        }
    })
}

/** DTO for prediction summaries, used for navigation. FAST. */
export interface PredictionSummary {
    rank: number
    routeId: string
}

/** fetches a lightweight list of prediction summaries for a target. */
export async function getPredictionSummaries(targetId: string, runId: string): Promise<PredictionSummary[]> {
    return routeData.findPredictionSummaries(targetId, runId)
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
    // this now calls the much more efficient function from prediction.data
    return predictionData.findPredictionRunsForTarget(targetId)
}

// ============================================================================
// Run Detail Page Functions
// ============================================================================

/** DTO for the run detail page breadcrumb. */
export interface RunDetailBreadcrumbData {
    modelName: string
    benchmarkId: string
    benchmarkName: string
}

/** Prepares the DTO for the run detail page breadcrumb. FAST. */
export async function getPredictionRunBreadcrumbData(runId: string): Promise<RunDetailBreadcrumbData> {
    const run = await runData.findPredictionRunBreadcrumbData(runId)
    return {
        modelName: run.modelInstance.name,
        benchmarkId: run.benchmarkSet.id,
        benchmarkName: run.benchmarkSet.name,
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

/** DTO for the run detail page header. */
export interface RunDetailHeaderData {
    modelName: string
    benchmarkId: string
    benchmarkName: string
    hasAcceptableRoutes: boolean
    totalRoutes: number
    executedAt: Date
    totalWallTime?: number | null
    totalCost?: number | null
}

/** Prepares the DTO for the run detail page header. */
export async function getPredictionRunHeader(runId: string): Promise<RunDetailHeaderData> {
    const run = await runData.findPredictionRunHeaderById(runId)
    return {
        modelName: run.modelInstance.name,
        benchmarkId: run.benchmarkSet.id,
        benchmarkName: run.benchmarkSet.name,
        hasAcceptableRoutes: run.benchmarkSet.hasAcceptableRoutes,
        totalRoutes: run.totalRoutes,
        executedAt: run.executedAt,
        totalWallTime: run.statistics[0]?.totalWallTime ?? null,
        totalCost: run.totalCost,
    }
}

/**
 * Determines the default stock and target for a run.
 * Used to render the initial page state without a client-side redirect.
 */
export async function getRunDefaults(
    runId: string,
    currentStockId?: string,
    currentTargetId?: string
): Promise<{ stockId: string | undefined; targetId: string | undefined }> {
    if (currentStockId) {
        // If stock is set, we just need to check if we should default the target
        if (currentTargetId) return { stockId: currentStockId, targetId: currentTargetId }
        const targetIds = await getTargetIdsByRun(runId)
        return { stockId: currentStockId, targetId: targetIds[0] }
    }

    // No stock is set, so find the first available one
    const stocks = await getStocksForRun(runId)
    if (stocks.length === 0) return { stockId: undefined, targetId: undefined }

    const defaultStockId = stocks[0].id
    const targetIds = await getTargetIdsByRun(runId)
    return { stockId: defaultStockId, targetId: targetIds[0] }
}

/**
 * The "mega-dto" orchestrator for the target display section.
 * Fetches and composes ALL data needed for this UI section in parallel waves
 * to eliminate component-level request waterfalls.
 */
export async function getTargetDisplayData(
    runId: string,
    targetId: string,
    rank: number,
    stockId?: string,
    acceptableIndexProp?: number,
    viewMode?: string
): Promise<TargetDisplayData> {
    // --- Wave 1: Fetch all independent base data in parallel ---
    const [targetPayload, predictionSummaries, acceptableRoutes, prediction, firstMatchRank] = await Promise.all([
        benchmarkData.findTargetWithDetailsById(targetId),
        routeData.findPredictionSummaries(targetId, runId),
        routeData.findAcceptableRoutesForTarget(targetId),
        routeData.findSinglePredictionForTarget(targetId, runId, rank, stockId),
        stockId ? routeData.findFirstAcceptableMatchRank(targetId, runId, stockId) : Promise.resolve(undefined),
    ])

    // --- Process Wave 1 results and prepare for Wave 2 ---
    const totalPredictions = predictionSummaries.length
    const hasPredictions = totalPredictions > 0
    const totalAcceptableRoutes = acceptableRoutes.length
    const currentAcceptableIndex =
        totalAcceptableRoutes > 0 ? Math.min(Math.max(0, acceptableIndexProp ?? 0), totalAcceptableRoutes - 1) : 0
    const selectedAcceptable = totalAcceptableRoutes > 0 ? acceptableRoutes[currentAcceptableIndex] : undefined

    const targetInfo: TargetInfo = {
        targetId: targetPayload.targetId,
        molecule: targetPayload.molecule,
        routeLength: targetPayload.routeLength,
        isConvergent: targetPayload.isConvergent,
        hasAcceptableRoutes: targetPayload.acceptableRoutesCount > 0,
        acceptableMatchRank: firstMatchRank ?? undefined,
    }

    // --- Wave 2: Fetch route node data based on IDs from Wave 1 ---
    const nodePromises = []
    if (prediction) {
        nodePromises.push(routeData.findNodesForRoute(prediction.route.id))
    }
    if (selectedAcceptable) {
        nodePromises.push(routeData.findNodesForRoute(selectedAcceptable.route.id))
    }
    const [predictedNodes, acceptableNodes] = await Promise.all(nodePromises)

    // --- Process Wave 2: Build trees and collect all molecules ---
    const allInchiKeys = new Set<string>()
    let predictedVizNode: RouteVisualizationNode | null = null
    let acceptableVizNode: RouteVisualizationNode | null = null

    if (predictedNodes && predictedNodes.length > 0) {
        const tree = buildRouteTree(predictedNodes)
        predictedVizNode = toVisualizationNode(tree)
        getAllRouteInchiKeysSet(predictedVizNode).forEach((key) => allInchiKeys.add(key))
    }
    if (acceptableNodes && acceptableNodes.length > 0) {
        const tree = buildRouteTree(acceptableNodes)
        acceptableVizNode = toVisualizationNode(tree)
        getAllRouteInchiKeysSet(acceptableVizNode).forEach((key) => allInchiKeys.add(key))
    }

    // --- Wave 3: Fetch stock data for all collected molecules ---
    let inStockInchiKeys = new Set<string>()
    let buyableMetadataMap = new Map<string, BuyableMetadata>()
    let stockName: string | undefined

    if (stockId) {
        // We still fetch stock name in parallel with the main data query
        const [stockItems, stockNameResult] = await Promise.all([
            allInchiKeys.size > 0
                ? stockData.findStockDataForInchiKeys(Array.from(allInchiKeys), stockId)
                : Promise.resolve([]),
            stockData.findStockNameById(stockId),
        ])

        stockName = stockNameResult?.name

        // Process the single result array into both the Set and the Map
        for (const item of stockItems) {
            inStockInchiKeys.add(item.molecule.inchikey)
            buyableMetadataMap.set(item.molecule.inchikey, item)
        }
    }

    // --- Final Assembly: Construct the mega-DTO ---
    const currentPrediction = prediction
        ? (() => {
              // create a scope to safely handle the nullable 'prediction'
              const solvabilityRecord = prediction.solvabilityStatus.find((s) => s.stockId === stockId)
              return {
                  predictionRoute: prediction,
                  route: prediction.route,
                  visualizationNode: predictedVizNode!,
                  solvability: solvabilityRecord
                      ? {
                            stockId: solvabilityRecord.stockId,
                            stockName: solvabilityRecord.stock.name,
                            isSolvable: solvabilityRecord.isSolvable,
                            matchesAcceptable: solvabilityRecord.matchesAcceptable,
                        }
                      : undefined,
              }
          })()
        : null

    return {
        targetInfo: { ...targetInfo, hasNoPredictions: !hasPredictions },
        totalPredictions,
        currentRank: rank,
        currentPrediction,
        acceptableRoute: acceptableVizNode ? { visualizationNode: acceptableVizNode } : null,
        totalAcceptableRoutes,
        currentAcceptableIndex,
        stockInfo: {
            stockId,
            stockName,
            inStockInchiKeys,
            buyableMetadataMap,
        },
        viewMode,
    }
}
