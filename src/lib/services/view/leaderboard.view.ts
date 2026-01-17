/**
 * view model composition layer for the leaderboard.
 * this file is a pure data transformer, consuming the `stats.data` layer.
 */

import type { LeaderboardEntry, MetricResult, ReliabilityCode, StratifiedMetric } from '@/types'
import * as statsData from '@/lib/services/data/stats.data.ts'

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

/** prepares the DTO for the main leaderboard page. */
export async function getLeaderboard(benchmarkId?: string, stockId?: string): Promise<LeaderboardEntry[]> {
    const rawStats = await statsData.findStatisticsForLeaderboard({
        ...(stockId && { stockId }),
        ...(benchmarkId && { predictionRun: { benchmarkSetId: benchmarkId } }),
    })

    return rawStats.map((stat) => {
        const solvabilityMetric = stat.metrics.find((m) => m.metricName === 'Solvability' && m.groupKey === null)
        const topKMetrics = stat.predictionRun.benchmarkSet.hasAcceptableRoutes
            ? stat.metrics.filter((m) => m.metricName.startsWith('Top-') && m.groupKey === null)
            : []

        const topKAccuracy: Record<string, MetricResult> = {}
        for (const metric of topKMetrics) {
            topKAccuracy[metric.metricName] = toMetricResult(metric)
        }

        return {
            modelName: stat.predictionRun.modelInstance.name,
            benchmarkName: stat.predictionRun.benchmarkSet.name,
            stockName: stat.stock.name,
            metrics: {
                solvability: toMetricResult(solvabilityMetric),
                ...(Object.keys(topKAccuracy).length > 0 && { topKAccuracy }),
            },
            totalWallTime: stat.totalWallTime,
            totalCost: stat.predictionRun.totalCost,
        }
    })
}

/** prepares the DTO for stratified metric charts. */
export async function getStratifiedMetrics(
    benchmarkId: string,
    stockIds?: string[]
): Promise<[string, [string, { solvability: StratifiedMetric; topKAccuracy?: Record<string, StratifiedMetric> }][]][]> {
    const rawStats = await statsData.findStatisticsForLeaderboard({
        predictionRun: { benchmarkSetId: benchmarkId },
        ...(stockIds && { stockId: { in: stockIds } }),
    })

    const result = new Map<
        string,
        Map<string, { solvability: StratifiedMetric; topKAccuracy?: Record<string, StratifiedMetric> }>
    >()

    for (const stat of rawStats) {
        const stockId = stat.stockId
        const modelName = stat.predictionRun.modelInstance.name

        if (!result.has(stockId)) result.set(stockId, new Map())
        const stockMap = result.get(stockId)!

        const buildStratifiedMetric = (name: string): StratifiedMetric | null => {
            const metricsForName = stat.metrics.filter((m) => m.metricName === name)
            if (metricsForName.length === 0) return null
            const overall = metricsForName.find((m) => m.groupKey === null)
            const byGroup = Object.fromEntries(
                metricsForName.filter((m) => m.groupKey !== null).map((m) => [m.groupKey!, toMetricResult(m)])
            )
            return { metricName: name, overall: toMetricResult(overall), byGroup }
        }

        const solvability = buildStratifiedMetric('Solvability')
        if (!solvability) continue

        let topKAccuracy: Record<string, StratifiedMetric> | undefined
        if (stat.predictionRun.benchmarkSet.hasAcceptableRoutes) {
            const topKNames = [
                ...new Set(stat.metrics.filter((m) => m.metricName.startsWith('Top-')).map((m) => m.metricName)),
            ]
            const acc: Record<string, StratifiedMetric> = {}
            for (const name of topKNames) {
                const metric = buildStratifiedMetric(name)
                if (metric) acc[name] = metric
            }
            if (Object.keys(acc).length > 0) topKAccuracy = acc
        }
        stockMap.set(modelName, { solvability, ...(topKAccuracy && { topKAccuracy }) })
    }

    return Array.from(result.entries(), ([stockId, modelMap]) => [stockId, Array.from(modelMap.entries())])
}

/** parses the rank distribution from the raw JSON blob. */
export async function getModelRankDistribution(
    runId: string,
    stockId: string
): Promise<{
    rankDistribution: Array<{ rank: number; probability: number }>
    expectedRank?: number
}> {
    const { statisticsJson } = await statsData.findStatisticsJson(runId, stockId)
    try {
        const parsed = JSON.parse(statisticsJson)
        return {
            rankDistribution: parsed.rankDistribution || [],
            expectedRank: parsed.expectedRank,
        }
    } catch {
        throw new Error('failed to parse statistics JSON.')
    }
}
