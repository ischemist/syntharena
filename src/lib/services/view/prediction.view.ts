/**
 * view model composition layer for predictions and routes.
 * rule: this file is FORBIDDEN from importing `prisma`.
 * it consumes functions from `run.data.ts` and `route.data.ts` to build
 * DTOs for the prediction-focused UI components.
 */

import { Prisma } from '@prisma/client'

import type {
    BenchmarkTargetWithMolecule,
    BuyableMetadata,
    MetricResult,
    ModelStatistics,
    PredictionRunWithStats,
    ReliabilityCode,
    RouteNodeWithDetails,
    RunStatistics,
    StockListItem,
    StratifiedMetric,
    SubmissionType,
    TargetDisplayData,
    TargetInfo,
    VendorSource,
} from '@/types'
import { getAllRouteInchiKeysSet } from '@/lib/route-visualization'
import * as benchmarkData from '@/lib/services/data/benchmark.data'
import * as modelFamilyData from '@/lib/services/data/model-family.data'
import * as predictionData from '@/lib/services/data/prediction.data'
import * as routeData from '@/lib/services/data/route.data'
import * as runData from '@/lib/services/data/run.data'
import * as statsData from '@/lib/services/data/stats.data'
import * as stockData from '@/lib/services/data/stock.data'
import { buildRouteTree } from '@/lib/tree-builder/route-tree'

import { toVisualizationNode } from './route.view'

// ============================================================================
// private helpers
// ============================================================================

/** a pure, testable helper for processing raw stock item data. */
function _processStockData(
    stockItems: Array<{
        ppg: number | null
        source: VendorSource | null
        leadTime: string | null
        link: string | null
        molecule: { inchikey: string }
    }>
) {
    const inStockInchiKeys = new Set<string>()
    const buyableMetadataMap = new Map<string, BuyableMetadata>()

    for (const item of stockItems) {
        inStockInchiKeys.add(item.molecule.inchikey)
        // FIX: explicitly construct the BuyableMetadata object to match the type
        buyableMetadataMap.set(item.molecule.inchikey, {
            ppg: item.ppg,
            source: item.source,
            leadTime: item.leadTime,
            link: item.link,
        })
    }

    return { inStockInchiKeys, buyableMetadataMap }
}

/** a pure, testable helper for calculating all navigation hrefs for the run target display. */
function _buildRunTargetNavigation(
    runId: string,
    params: {
        targetId: string
        rank: number
        stockId?: string
        acceptableIndex?: number
        viewMode?: string
    },
    data: {
        availableRanks: number[]
        totalAcceptableRoutes: number
    }
) {
    const buildHref = (paramToChange: string, newValue: number) => {
        const search = new URLSearchParams()
        search.set('target', params.targetId)
        search.set('rank', params.rank.toString())
        if (params.stockId) search.set('stock', params.stockId)
        if (params.acceptableIndex !== undefined) search.set('acceptableIndex', params.acceptableIndex.toString())
        if (params.viewMode) search.set('view', params.viewMode)

        search.set(paramToChange, newValue.toString())
        return `/runs/${runId}?${search.toString()}`
    }

    // 1. predicted route navigation
    const currentRankIndex = data.availableRanks.indexOf(params.rank)
    let previousRankHref: string | null = null
    let nextRankHref: string | null = null
    if (currentRankIndex !== -1) {
        if (currentRankIndex > 0) {
            previousRankHref = buildHref('rank', data.availableRanks[currentRankIndex - 1])
        }
        if (currentRankIndex < data.availableRanks.length - 1) {
            nextRankHref = buildHref('rank', data.availableRanks[currentRankIndex + 1])
        }
    }

    // 2. acceptable route navigation
    const currentAcceptableIndex = params.acceptableIndex ?? 0
    const acceptableRanks = Array.from({ length: data.totalAcceptableRoutes }, (_, i) => i)
    let prevAccHref: string | null = null
    let nextAccHref: string | null = null
    if (data.totalAcceptableRoutes > 1) {
        if (currentAcceptableIndex > 0) {
            prevAccHref = buildHref('acceptableIndex', currentAcceptableIndex - 1)
        }
        if (currentAcceptableIndex < data.totalAcceptableRoutes - 1) {
            nextAccHref = buildHref('acceptableIndex', currentAcceptableIndex + 1)
        }
    }

    return {
        predictionNav: {
            currentRank: params.rank,
            availableRanks: data.availableRanks,
            previousRankHref,
            nextRankHref,
        },
        acceptableNav: {
            currentAcceptableIndex,
            availableRanks: acceptableRanks,
            previousRankHref: prevAccHref,
            nextRankHref: nextAccHref,
        },
    }
}

// ============================================================================
// public view model orchestrators
// ============================================================================

/** prepares the DTO for the main prediction run list page. */
export async function getPredictionRuns(
    benchmarkId?: string,
    modelInstanceId?: string,
    modelFamilyIds?: string[],
    submissionType?: SubmissionType
): Promise<PredictionRunWithStats[]> {
    const runs = await runData.findPredictionRunsForList({
        benchmarkSet: {
            isListed: true,
            ...(benchmarkId && { id: benchmarkId }),
        },
        ...(modelInstanceId && { modelInstanceId }),
        ...(modelFamilyIds &&
            modelFamilyIds.length > 0 && { modelInstance: { modelFamilyId: { in: modelFamilyIds } } }),
        ...(submissionType && { submissionType }),
    })

    return runs.map((run) => {
        const solvabilitySummary: Record<string, number> = {}
        for (const stat of run.statistics) {
            const solvabilityMetric = stat.metrics.find((m) => m.metricName === 'Solvability')
            if (solvabilityMetric) {
                solvabilitySummary[stat.stockId] = solvabilityMetric.value
            }
        }
        const toMetricResult = (metric?: (typeof run.statistics)[0]['metrics'][0]): MetricResult | null => {
            if (!metric) return null
            return {
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

        const top1Accuracy = toMetricResult(run.statistics[0]?.metrics.find((m) => m.metricName === 'Top-1'))
        const top10Accuracy = toMetricResult(run.statistics[0]?.metrics.find((m) => m.metricName === 'Top-10'))

        return {
            id: run.id,
            modelInstanceId: run.modelInstanceId,
            benchmarkSetId: run.benchmarkSetId,
            modelInstance: {
                ...run.modelInstance,
                family: {
                    ...run.modelInstance.family,
                    description: run.modelInstance.family.description ?? undefined,
                },
            },
            benchmarkSet: run.benchmarkSet,
            totalRoutes: run.totalRoutes,
            hourlyCost: run.hourlyCost,
            totalCost: run.totalCost,
            totalWallTime: run.statistics[0]?.totalWallTime ?? null,
            avgRouteLength: run.avgRouteLength,
            solvabilitySummary,
            top1Accuracy,
            top10Accuracy,
            executedAt: run.executedAt,
            submissionType: run.submissionType,
            isRetrained: run.isRetrained,
        }
    })
}

/** returns all model families that have at least one prediction run. */
export async function getModelFamiliesWithRuns() {
    return modelFamilyData.findAllModelFamiliesWithRuns()
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
    availableRanks: number[]
}

/** aggregates prediction routes into run summaries for a target. */
export async function getPredictionRunsForTarget(
    targetId: string,
    viewMode: 'curated' | 'forensic' = 'curated'
): Promise<PredictionRunSummary[]> {
    const rawRuns = await predictionData.findPredictionRunsForTarget(targetId, viewMode)

    // fetch all rank summaries in parallel
    const summaryPromises = rawRuns.map((run) => routeData.findPredictionSummaries(targetId, run.id))
    const allSummaries = await Promise.all(summaryPromises)

    return rawRuns.map((run, i) => {
        const summaries = allSummaries[i]
        const availableRanks = summaries.map((s) => s.rank)

        const { versionMajor, versionMinor, versionPatch, versionPrerelease } = run.modelInstance
        let versionString = `v${versionMajor}.${versionMinor}.${versionPatch}`
        if (versionPrerelease) versionString += `-${versionPrerelease}`

        return {
            id: run.id,
            modelName: run.modelInstance.family.name,
            modelVersion: versionString,
            algorithmName: run.modelInstance.family.algorithm.name,
            executedAt: run.executedAt,
            routeCount: run._count.predictionRoutes,
            availableRanks,
        }
    })
}

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
        modelName: run.modelInstance.family.name,
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
    return benchmarkData.findTargetIdsByBenchmark(run.benchmarkSet.id, routeLength)
}

/** returns distinct route lengths available for filtering. */
export async function getAvailableRouteLengths(runId: string): Promise<number[]> {
    const run = await runData.findPredictionRunDetailsById(runId)
    if (!run.benchmarkSet.hasAcceptableRoutes) {
        return []
    }
    return benchmarkData.findAvailableRouteLengths(run.benchmarkSet.id)
}

/** returns full statistics for a run against a stock. */
export async function getRunStatistics(runId: string, stockId: string): Promise<RunStatistics> {
    const stats = await statsData.findStatisticsForRun(runId, stockId)

    let parsedStats: ModelStatistics | undefined
    try {
        parsedStats = JSON.parse(stats.statisticsJson) as ModelStatistics
    } catch (error) {
        console.error('Failed to parse statistics JSON:', error)
    }

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

/**
 * searches targets within a run's benchmark by targetId or SMILES.
 */
export async function searchTargets(
    runId: string,
    query: string,
    stockId?: string,
    routeLength?: number,
    limit: number = 20
): Promise<BenchmarkTargetWithMolecule[]> {
    const where: Prisma.BenchmarkTargetWhereInput = {}
    if (query?.trim()) {
        const q = query.trim()
        where.OR = [{ targetId: { contains: q } }, { molecule: { smiles: { contains: q } } }]
    }
    if (routeLength !== undefined) {
        where.routeLength = routeLength
    }

    const { targets, counts } = await predictionData.findTargetsAndPredictionCountsForRun(runId, where, limit)
    const countMap = new Map(counts.map((c) => [c.targetId, c._count._all]))

    return targets.map((target) => ({
        ...target,
        hasAcceptableRoutes: false,
        acceptableRoutesCount: 0,
        routeCount: countMap.get(target.id) ?? 0,
    }))
}

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

/** Fallback for when JSON parsing fails. */
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
    // ... implementation remains the same
    const solvabilityMetrics = metrics.filter((m) => m.metricName === 'Solvability')
    const topKMetrics = metrics.filter((m) => m.metricName.startsWith('Top-'))
    const solvabilityOverall = solvabilityMetrics.find((m) => m.groupKey === null)
    const solvabilityByGroup: Record<number, MetricResult> = {}
    for (const metric of solvabilityMetrics.filter((m) => m.groupKey !== null)) {
        solvabilityByGroup[metric.groupKey!] = {
            value: metric.value,
            ciLower: metric.ciLower,
            ciUpper: metric.ciUpper,
            nSamples: metric.nSamples,
            reliability: { code: metric.reliabilityCode as ReliabilityCode, message: metric.reliabilityMessage },
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
            : { value: 0, ciLower: 0, ciUpper: 0, nSamples: 0, reliability: { code: 'LOW_N', message: 'No data' } },
        byGroup: solvabilityByGroup,
    }
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
                reliability: { code: metric.reliabilityCode as ReliabilityCode, message: metric.reliabilityMessage },
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
    return { solvability, ...(Object.keys(topKAccuracy).length > 0 && { topKAccuracy }) }
}

/** DTO for the new run detail page title card. */
export interface RunTitleCardData {
    modelFamilyName: string
    modelFamilySlug: string
    algorithmName: string
    algorithmSlug: string
    benchmarkId: string
    benchmarkName: string
    submissionType: SubmissionType
    isRetrained?: boolean | null
    totalRoutes: number
    executedAt: Date
    totalWallTime?: number | null
    totalCost?: number | null
}

/** Prepares the DTO for the new run detail page title card. */
export async function getRunTitleCardData(runId: string): Promise<RunTitleCardData> {
    const run = await runData.findPredictionRunDetailsById(runId)
    const { modelInstance, benchmarkSet, statistics } = run
    return {
        modelFamilyName: modelInstance.family.name,
        modelFamilySlug: modelInstance.family.slug,
        algorithmName: modelInstance.family.algorithm.name,
        algorithmSlug: modelInstance.family.algorithm.slug,
        benchmarkId: benchmarkSet.id,
        benchmarkName: benchmarkSet.name,
        submissionType: run.submissionType,
        isRetrained: run.isRetrained,
        totalRoutes: run.totalRoutes,
        executedAt: run.executedAt,
        totalWallTime: statistics[0]?.totalWallTime ?? null,
        totalCost: run.totalCost,
    }
}

/** Determines the default stock and target for a run. */
export async function getRunDefaults(
    runId: string,
    currentStockId?: string,
    currentTargetId?: string
): Promise<{ stockId: string | undefined; targetId: string | undefined }> {
    if (currentStockId) {
        if (currentTargetId) return { stockId: currentStockId, targetId: currentTargetId }
        const targetIds = await getTargetIdsByRun(runId)
        return { stockId: currentStockId, targetId: targetIds[0] }
    }
    const stocks = await getStocksForRun(runId)
    if (stocks.length === 0) return { stockId: undefined, targetId: undefined }
    const defaultStockId = stocks[0].id
    const targetIds = await getTargetIdsByRun(runId)
    return { stockId: defaultStockId, targetId: targetIds[0] }
}

/** The "mega-dto" orchestrator for the target display section. */
export async function getTargetDisplayData(
    runId: string,
    targetId: string,
    rank: number,
    stockId?: string,
    acceptableIndexProp?: number,
    viewMode?: string
): Promise<TargetDisplayData> {
    // Wave 1
    const [targetPayload, predictionSummaries, acceptableRoutes, prediction, firstMatchRank] = await Promise.all([
        benchmarkData.findTargetWithDetailsById(targetId),
        routeData.findPredictionSummaries(targetId, runId),
        routeData.findAcceptableRoutesForTarget(targetId),
        routeData.findSinglePredictionForTarget(targetId, runId, rank, stockId),
        stockId ? routeData.findFirstAcceptableMatchRank(targetId, runId, stockId) : Promise.resolve(undefined),
    ])

    // Process Wave 1
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

    // Wave 2
    const [predictedNodes, acceptableNodes] = await Promise.all([
        prediction ? routeData.findNodesForRoute(prediction.route.id) : Promise.resolve(undefined),
        selectedAcceptable ? routeData.findNodesForRoute(selectedAcceptable.route.id) : Promise.resolve(undefined),
    ])

    // Process Wave 2
    const allInchiKeys = new Set<string>()
    const predictedVizNode = predictedNodes ? toVisualizationNode(buildRouteTree(predictedNodes)) : null
    if (predictedVizNode) getAllRouteInchiKeysSet(predictedVizNode).forEach((key) => allInchiKeys.add(key))
    const acceptableVizNode = acceptableNodes ? toVisualizationNode(buildRouteTree(acceptableNodes)) : null
    if (acceptableVizNode) getAllRouteInchiKeysSet(acceptableVizNode).forEach((key) => allInchiKeys.add(key))

    // Wave 3
    let stockName: string | undefined
    let stockDataResult = {
        inStockInchiKeys: new Set<string>(),
        buyableMetadataMap: new Map<string, BuyableMetadata>(),
    }
    if (stockId) {
        const [stockItems, stockNameResult] = await Promise.all([
            allInchiKeys.size > 0
                ? stockData.findStockDataForInchiKeys(Array.from(allInchiKeys), stockId)
                : Promise.resolve([]),
            stockData.findStockNameById(stockId),
        ])
        stockName = stockNameResult?.name
        stockDataResult = _processStockData(stockItems)
    }

    // Final Assembly
    const navState = _buildRunTargetNavigation(
        runId,
        { targetId, rank, stockId, acceptableIndex: currentAcceptableIndex, viewMode },
        { availableRanks: predictionSummaries.map((s) => s.rank), totalAcceptableRoutes }
    )

    const currentPrediction =
        prediction && predictedVizNode
            ? (() => {
                  const solvabilityRecord = prediction.solvabilityStatus.find((s) => s.stockId === stockId)
                  return {
                      predictionRoute: prediction,
                      route: prediction.route,
                      visualizationNode: predictedVizNode,
                      // FIX: correctly map the record to the DTO shape
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
        currentPrediction,
        acceptableRoute: acceptableVizNode ? { visualizationNode: acceptableVizNode } : null,
        totalAcceptableRoutes,
        currentAcceptableIndex,
        stockInfo: {
            stockId,
            stockName,
            ...stockDataResult,
        },
        viewMode,
        navigation: navState.predictionNav,
        acceptableRouteNav: navState.acceptableNav,
    }
}
