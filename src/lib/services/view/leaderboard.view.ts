/**
 * view model composition layer for the leaderboard.
 * this file is a pure data transformer, consuming the `stats.data` layer.
 * it follows the "unified fetch" doctrine: fetch all raw data once, then
 * transform it into all necessary DTOs in a single pass.
 */

import type {
    BenchmarkListItem,
    LeaderboardEntry,
    MetricResult,
    ReliabilityCode,
    StockListItem,
    StratifiedMetric,
} from '@/types'
import * as benchmarkData from '@/lib/services/data/benchmark.data' // new import
import * as statsData from '@/lib/services/data/stats.data'

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
}

// helper to transform a raw metric record into a MetricResult DTO
function toMetricResult(
    metric?: {
        value: number
        ciLower: number
        ciUpper: number
        nSamples: number
        reliabilityCode: string
        reliabilityMessage: string
    } | null
): MetricResult {
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

/**
 * [REFACTORED] fetches and composes all data for the leaderboard page in one go.
 * this is the single entry point for this route's data.
 */
export async function getLeaderboardPageData(benchmarkId?: string): Promise<LeaderboardPageData | null> {
    // wave 1: fetch all LISTED benchmarks to determine the effective id and populate the dropdown.
    const allBenchmarksRaw = await benchmarkData.findBenchmarkListItems()
    if (allBenchmarksRaw.length === 0) return null

    const allBenchmarks = allBenchmarksRaw.map((b) => ({ id: b.id, name: b.name, series: b.series }))

    const effectiveBenchmarkId =
        benchmarkId && allBenchmarks.some((b) => b.id === benchmarkId) ? benchmarkId : allBenchmarks[0].id

    // wave 2: fetch all data for the effective benchmark in parallel.
    const [rawStats, selectedBenchmarkRaw] = await Promise.all([
        statsData.findStatisticsForLeaderboard({
            predictionRun: { benchmarkSetId: effectiveBenchmarkId },
        }),
        benchmarkData.findBenchmarkListItemById(effectiveBenchmarkId),
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
        }
    }

    const leaderboardEntries: LeaderboardEntry[] = []
    const stratifiedMetricsByStock = new Map<
        string,
        Map<string, { solvability: StratifiedMetric; topKAccuracy?: Record<string, StratifiedMetric> }>
    >()
    const stocksMap = new Map<string, StockListItem>()

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
    for (const stat of rawStats) {
        const { stock, predictionRun, metrics } = stat
        const modelName = predictionRun.modelInstance.name

        // -- 1. build leaderboard entry (flat list) --
        const solvabilityMetric = metrics.find((m) => m.metricName === 'Solvability' && m.groupKey === null)
        const topKMetrics = selectedBenchmark.hasAcceptableRoutes
            ? metrics.filter((m) => m.metricName.startsWith('Top-') && m.groupKey === null)
            : []

        const topKAccuracy: Record<string, MetricResult> = {}
        for (const metric of topKMetrics) {
            topKAccuracy[metric.metricName] = toMetricResult(metric)
        }

        leaderboardEntries.push({
            modelName,
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
        if (selectedBenchmark.hasAcceptableRoutes) {
            const acc: Record<string, StratifiedMetric> = {}
            ;[...topKMetricNames].forEach((name) => {
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

    const sortedTopKNames = Array.from(topKMetricNames).sort((a, b) => {
        const aNum = parseInt(a.replace(/^\D+/, ''))
        const bNum = parseInt(b.replace(/^\D+/, ''))
        return aNum - bNum
    })

    return {
        leaderboardEntries,
        stratifiedMetricsByStock,
        stocks: Array.from(stocksMap.values()),
        metadata: {
            hasAcceptableRoutes: selectedBenchmark.hasAcceptableRoutes,
            availableTopKMetrics: sortedTopKNames,
        },
        allBenchmarks,
        selectedBenchmark,
    }
}
