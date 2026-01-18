/**
 * view model composition layer for the leaderboard.
 * this file is a pure data transformer, consuming the `stats.data` layer.
 * it follows the "unified fetch" doctrine: fetch all raw data once, then
 * transform it into all necessary DTOs in a single pass.
 */

import type { LeaderboardEntry, MetricResult, ReliabilityCode, StockListItem, StratifiedMetric } from '@/types'
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
 * [OPTIMIZED] fetches and composes all data for the leaderboard page in one go.
 * this is the single entry point for this route's data.
 */
export async function getLeaderboardPageData(benchmarkId: string): Promise<LeaderboardPageData | null> {
    const rawStats = await statsData.findStatisticsForLeaderboard({
        predictionRun: { benchmarkSetId: benchmarkId },
    })

    if (rawStats.length === 0) return null

    const leaderboardEntries: LeaderboardEntry[] = []
    const stratifiedMetricsByStock = new Map<
        string,
        Map<string, { solvability: StratifiedMetric; topKAccuracy?: Record<string, StratifiedMetric> }>
    >()
    const stocksMap = new Map<string, StockListItem>()
    const topKMetricNames = new Set<string>()

    const hasAcceptableRoutes = rawStats.some((stat) => stat.predictionRun.benchmarkSet.hasAcceptableRoutes)

    for (const stat of rawStats) {
        const { stock, predictionRun, metrics } = stat
        const modelName = predictionRun.modelInstance.name

        // -- 1. build leaderboard entry (flat list) --
        const solvabilityMetric = metrics.find((m) => m.metricName === 'Solvability' && m.groupKey === null)
        const topKMetrics = hasAcceptableRoutes
            ? metrics.filter((m) => m.metricName.startsWith('Top-') && m.groupKey === null)
            : []

        const topKAccuracy: Record<string, MetricResult> = {}
        for (const metric of topKMetrics) {
            topKAccuracy[metric.metricName] = toMetricResult(metric)
            topKMetricNames.add(metric.metricName) // collect available metric names
        }

        leaderboardEntries.push({
            modelName,
            benchmarkName: predictionRun.benchmarkSet.name,
            stockName: stock.name,
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
            hasAcceptableRoutes,
            availableTopKMetrics: sortedTopKNames,
        },
    }
}
