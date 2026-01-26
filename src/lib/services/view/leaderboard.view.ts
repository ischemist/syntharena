/**
 * view model composition layer for the leaderboard.
 * this file is a pure data transformer, consuming the `stats.data` layer.
 * it follows the "unified fetch" doctrine: fetch all raw data once, then
 * transform it into all necessary DTOs in a single pass.
 */

import { Prisma } from '@prisma/client'

import type {
    BenchmarkListItem,
    LeaderboardEntry,
    MetricResult,
    ReliabilityCode,
    StockListItem,
    StratifiedMetric,
} from '@/types'
import * as benchmarkData from '@/lib/services/data/benchmark.data'
import * as statsData from '@/lib/services/data/stats.data'
import { formatVersion } from '@/lib/utils'

// ============================================================================
// types
// ============================================================================

/** the comprehensive DTO for the entire leaderboard page. */
export interface LeaderboardPageData {
    leaderboardEntries: LeaderboardEntry[]
    /** key is stockId, value is a map of modelName to its metrics. */
    stratifiedMetricsByStock: Map<
        string,
        Map<string, { solvability: StratifiedMetric; topKAccuracy?: Record<string, StratifiedMetric> }>
    >
    stocks: StockListItem[] // list of stocks that have metrics for this benchmark
    metadata: {
        hasAcceptableRoutes: boolean
        availableTopKMetrics: string[]
    }
    allBenchmarks: Array<{ id: string; name: string; series: BenchmarkListItem['series'] }>
    selectedBenchmark: BenchmarkListItem
    firstTargetId: string | null
}

type RawStatsPayload = Prisma.PromiseReturnType<typeof statsData.findStatisticsForLeaderboard>

// ============================================================================
// private helpers (transformation logic)
// ============================================================================

/**
 * filters a list of raw statistics to only include the "champion instance" for each model family.
 * a champion is defined as the instance with the highest top-10 accuracy, falling back to solvability.
 * this is a pure function: array in, array out.
 */
function _curateChampionStats(rawStats: RawStatsPayload): RawStatsPayload {
    const statsByFamilyId = new Map<string, RawStatsPayload>()
    for (const stat of rawStats) {
        const familyId = stat.predictionRun.modelInstance.family.id
        if (!statsByFamilyId.has(familyId)) {
            statsByFamilyId.set(familyId, [])
        }
        statsByFamilyId.get(familyId)!.push(stat)
    }

    const championStats: RawStatsPayload = []
    for (const [, familyStats] of statsByFamilyId) {
        // determine the best instance for this family
        const champion = familyStats.reduce((best, current) => {
            const getMetric = (s: typeof best, metricName: string) =>
                s.metrics.find((m) => m.metricName === metricName && m.groupKey === null)?.value ?? -1

            const bestTop10 = getMetric(best, 'Top-10')
            const currentTop10 = getMetric(current, 'Top-10')

            // if top-10 exists, it's the primary sorting key
            if (bestTop10 !== -1 || currentTop10 !== -1) {
                return currentTop10 > bestTop10 ? current : best
            }

            // otherwise, fall back to solvability
            const bestSolvability = getMetric(best, 'Solvability')
            const currentSolvability = getMetric(current, 'Solvability')
            return currentSolvability > bestSolvability ? current : best
        })
        championStats.push(champion)
    }
    return championStats
}

/**
 * performs the main data transformation pass, building all DTOs from the processed stats.
 * this pure function takes the definitive list of stats and returns the final data structures.
 */
function _transformStatsToLeaderboardDTOs(
    statsToProcess: RawStatsPayload,
    hasAcceptableRoutes: boolean,
    availableTopKMetrics: string[]
) {
    const leaderboardEntries: LeaderboardEntry[] = []
    const stratifiedMetricsByStock = new Map<
        string,
        Map<string, { solvability: StratifiedMetric; topKAccuracy?: Record<string, StratifiedMetric> }>
    >()
    const stocksMap = new Map<string, StockListItem>()

    // helper to transform a raw metric record into a MetricResult DTO
    const toMetricResult = (
        metric?: {
            value: number
            ciLower: number
            ciUpper: number
            nSamples: number
            reliabilityCode: string
            reliabilityMessage: string
        } | null
    ): MetricResult => {
        if (!metric) {
            return {
                value: 0,
                ciLower: 0,
                ciUpper: 0,
                nSamples: 0,
                reliability: { code: 'LOW_N', message: 'No data' },
            }
        }
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

    for (const stat of statsToProcess) {
        const { stock, predictionRun, metrics } = stat
        const { modelInstance } = predictionRun
        const modelName = modelInstance.family.name

        // -- 1. build leaderboard entry (flat list) --
        const solvabilityMetric = metrics.find((m) => m.metricName === 'Solvability' && m.groupKey === null)
        const topKMetrics = hasAcceptableRoutes
            ? metrics.filter((m) => m.metricName.startsWith('Top-') && m.groupKey === null)
            : []

        const topKAccuracy: Record<string, MetricResult> = {}
        for (const metric of topKMetrics) {
            topKAccuracy[metric.metricName] = toMetricResult(metric)
        }

        leaderboardEntries.push({
            runId: stat.predictionRun.id,
            benchmarkId: stat.predictionRun.benchmarkSetId,
            hasAcceptableRoutes: predictionRun.benchmarkSet.hasAcceptableRoutes,
            modelName,
            version: formatVersion(modelInstance),
            modelInstanceSlug: modelInstance.slug,
            benchmarkName: predictionRun.benchmarkSet.name,
            benchmarkSeries: predictionRun.benchmarkSet.series,
            stockName: stock.name,
            submissionType: predictionRun.submissionType,
            isRetrained: predictionRun.isRetrained,
            metrics: {
                solvability: toMetricResult(solvabilityMetric),
                ...(Object.keys(topKAccuracy).length > 0 && { topKAccuracy }),
            },
            totalWallTime: stat.totalWallTime,
            totalCost: predictionRun.totalCost,
        })

        // -- 2. build stratified metrics (nested map) --
        if (!stratifiedMetricsByStock.has(stock.id)) {
            stratifiedMetricsByStock.set(stock.id, new Map())
        }
        const modelMap = stratifiedMetricsByStock.get(stock.id)!

        const buildStratifiedMetric = (name: string): StratifiedMetric | null => {
            const metricsForName = metrics.filter((m) => m.metricName === name)
            if (metricsForName.length === 0) return null
            const overall = metricsForName.find((m) => m.groupKey === null)
            const byGroup = Object.fromEntries(
                metricsForName.filter((m) => m.groupKey !== null).map((m) => [m.groupKey!, toMetricResult(m)])
            )
            return { metricName: name, overall: toMetricResult(overall), byGroup }
        }

        const solvability = buildStratifiedMetric('Solvability')
        if (!solvability) continue

        let stratifiedTopK: Record<string, StratifiedMetric> | undefined
        if (hasAcceptableRoutes) {
            const acc: Record<string, StratifiedMetric> = {}
            ;[...availableTopKMetrics].forEach((name) => {
                const metric = buildStratifiedMetric(name)
                if (metric) acc[name] = metric
            })
            if (Object.keys(acc).length > 0) stratifiedTopK = acc
        }

        modelMap.set(modelName, { solvability, ...(stratifiedTopK && { topKAccuracy: stratifiedTopK }) })

        // -- 3. collect unique stocks --
        if (!stocksMap.has(stock.id)) {
            stocksMap.set(stock.id, {
                id: stock.id,
                name: stock.name,
                description: stock.description ?? undefined,
                itemCount: -1, // not needed on this page, but satisfies type
            })
        }
    }

    return {
        leaderboardEntries,
        stratifiedMetricsByStock,
        stocks: Array.from(stocksMap.values()),
    }
}

// ============================================================================
// public view model orchestrator
// ============================================================================

/**
 * fetches and composes all data for the leaderboard page in one go.
 * this is the single entry point for this route's data.
 */
export async function getLeaderboardPageData(
    benchmarkId?: string,
    viewMode: 'curated' | 'forensic' = 'curated'
): Promise<LeaderboardPageData | null> {
    // wave 1: fetch all LISTED benchmarks to determine the effective id and populate the dropdown.
    const allBenchmarksRaw = await benchmarkData.findBenchmarkListItems()
    if (allBenchmarksRaw.length === 0) return null

    const allBenchmarks = allBenchmarksRaw.map((b) => ({ id: b.id, name: b.name, series: b.series }))

    const effectiveBenchmarkId =
        benchmarkId && allBenchmarks.some((b) => b.id === benchmarkId) ? benchmarkId : allBenchmarks[0].id

    // wave 2: fetch all data for the effective benchmark in parallel.
    const [rawStats, selectedBenchmarkRaw, firstTargetId] = await Promise.all([
        statsData.findStatisticsForLeaderboard({
            predictionRun: { benchmarkSetId: effectiveBenchmarkId },
        }),
        benchmarkData.findBenchmarkListItemById(effectiveBenchmarkId),
        benchmarkData.findFirstTargetId(effectiveBenchmarkId),
    ])

    // transform selected benchmark data into DTO
    const selectedBenchmark: BenchmarkListItem = {
        id: selectedBenchmarkRaw.id,
        name: selectedBenchmarkRaw.name,
        description: selectedBenchmarkRaw.description || undefined,
        stockId: selectedBenchmarkRaw.stockId,
        stock: selectedBenchmarkRaw.stock,
        hasAcceptableRoutes: selectedBenchmarkRaw.hasAcceptableRoutes,
        createdAt: selectedBenchmarkRaw.createdAt,
        targetCount: selectedBenchmarkRaw._count.targets,
        series: selectedBenchmarkRaw.series,
    }

    if (rawStats.length === 0) {
        return {
            leaderboardEntries: [],
            stratifiedMetricsByStock: new Map(),
            stocks: [],
            metadata: {
                hasAcceptableRoutes: selectedBenchmark.hasAcceptableRoutes,
                availableTopKMetrics: [],
            },
            allBenchmarks,
            selectedBenchmark,
            firstTargetId,
        }
    }

    // determine available top-k metrics from the full, unfiltered dataset
    const topKMetricNames = new Set<string>()
    if (selectedBenchmark.hasAcceptableRoutes) {
        rawStats.forEach((stat) => {
            stat.metrics.forEach((metric) => {
                if (metric.metricName.startsWith('Top-')) {
                    topKMetricNames.add(metric.metricName)
                }
            })
        })
    }
    const sortedTopKNames = Array.from(topKMetricNames).sort((a, b) => {
        const aNum = parseInt(a.replace(/^\D+/, ''))
        const bNum = parseInt(b.replace(/^\D+/, ''))
        return aNum - bNum
    })

    // step 1: curate the stats if necessary
    const statsToProcess = viewMode === 'forensic' ? rawStats : _curateChampionStats(rawStats)

    // step 2: transform the processed stats into final DTOs
    const { leaderboardEntries, stratifiedMetricsByStock, stocks } = _transformStatsToLeaderboardDTOs(
        statsToProcess,
        selectedBenchmark.hasAcceptableRoutes,
        sortedTopKNames
    )

    // step 3: assemble final page-level DTO
    return {
        leaderboardEntries,
        stratifiedMetricsByStock,
        stocks,
        metadata: {
            hasAcceptableRoutes: selectedBenchmark.hasAcceptableRoutes,
            availableTopKMetrics: sortedTopKNames,
        },
        allBenchmarks,
        selectedBenchmark,
        firstTargetId,
    }
}
