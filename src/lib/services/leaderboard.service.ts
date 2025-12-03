import { unstable_cache } from 'next/cache'

import type { LeaderboardEntry, MetricResult, ReliabilityCode, StratifiedMetric } from '@/types'
import prisma from '@/lib/db'

// ============================================================================
// Core Read Functions
// ============================================================================

/**
 * Get leaderboard data for all models with optional filters.
 */
async function _getLeaderboard(benchmarkId?: string, stockId?: string): Promise<LeaderboardEntry[]> {
    // Fetch all statistics with filters
    const statistics = await prisma.modelRunStatistics.findMany({
        where: {
            ...(stockId && { stockId }),
            ...(benchmarkId && {
                predictionRun: {
                    benchmarkSetId: benchmarkId,
                },
            }),
        },
        include: {
            stock: true,
            predictionRun: {
                include: {
                    modelInstance: true,
                    benchmarkSet: true,
                },
            },
            metrics: true,
        },
        orderBy: [
            { predictionRun: { benchmarkSet: { name: 'asc' } } },
            { predictionRun: { modelInstance: { name: 'asc' } } },
        ],
    })

    // Transform to leaderboard entries
    return statistics.map((stat) => {
        // Helper to extract metric result
        const getMetricResult = (m?: (typeof stat.metrics)[0]): MetricResult => {
            if (!m) {
                return {
                    value: 0,
                    ciLower: 0,
                    ciUpper: 0,
                    nSamples: 0,
                    reliability: { code: 'LOW_N', message: 'No data' },
                }
            }
            return {
                value: m.value,
                ciLower: m.ciLower,
                ciUpper: m.ciUpper,
                nSamples: m.nSamples,
                reliability: {
                    code: m.reliabilityCode as ReliabilityCode,
                    message: m.reliabilityMessage,
                },
            }
        }

        // Get overall solvability metric
        const solvabilityMetric = stat.metrics.find((m) => m.metricName === 'Solvability' && m.groupKey === null)

        // Get top-k accuracy metrics (only if benchmark has ground truth)
        const topKAccuracy: Record<string, MetricResult> = {}
        if (stat.predictionRun.benchmarkSet.hasAcceptableRoutes) {
            const uniqueMetricNames = new Set(
                stat.metrics
                    .filter((m) => m.metricName.startsWith('Top-') && m.groupKey === null)
                    .map((m) => m.metricName)
            )

            for (const metricName of uniqueMetricNames) {
                const metric = stat.metrics.find((m) => m.metricName === metricName && m.groupKey === null)
                if (metric) {
                    topKAccuracy[metricName] = getMetricResult(metric)
                }
            }
        }

        return {
            modelName: stat.predictionRun.modelInstance.name,
            benchmarkName: stat.predictionRun.benchmarkSet.name,
            stockName: stat.stock.name,
            metrics: {
                solvability: getMetricResult(solvabilityMetric),
                ...(Object.keys(topKAccuracy).length > 0 && { topKAccuracy }),
            },
        }
    })
}

/**
 * Cached version of getLeaderboard.
 * Prevents re-aggregation on every request.
 */
export const getLeaderboard = unstable_cache(_getLeaderboard, ['leaderboard-entries'], {
    tags: ['leaderboard', 'metrics'],
    revalidate: 3600,
})

/**
 * Get stratified metrics for a benchmark, grouped by Stock ID.
 * Replaces the N+1 pattern of fetching per-stock.
 *
 * @param benchmarkId - The benchmark ID
 * @param stockIds - Optional: Specific stock IDs to fetch. If null, fetches all.
 * @returns Array of tuples [StockID, [ModelName, StratifiedData][]]
 */
async function _getStratifiedMetrics(
    benchmarkId: string,
    stockIds?: string[]
): Promise<
    [
        string, // Stock ID
        [
            string, // Model Name
            {
                solvability: StratifiedMetric
                topKAccuracy?: Record<string, StratifiedMetric>
            },
        ][],
    ][]
> {
    // Single optimized query for all requested stocks
    const statistics = await prisma.modelRunStatistics.findMany({
        where: {
            predictionRun: { benchmarkSetId: benchmarkId },
            ...(stockIds && { stockId: { in: stockIds } }),
        },
        include: {
            predictionRun: {
                include: { modelInstance: true, benchmarkSet: true },
            },
            metrics: true,
        },
    })

    // Nested Map Structure: StockID -> ModelName -> Data
    const result = new Map<
        string,
        Map<string, { solvability: StratifiedMetric; topKAccuracy?: Record<string, StratifiedMetric> }>
    >()

    for (const stat of statistics) {
        const stockId = stat.stockId
        const modelName = stat.predictionRun.modelInstance.name

        if (!result.has(stockId)) {
            result.set(stockId, new Map())
        }
        const stockMap = result.get(stockId)!

        // --- Helper: Build Stratified Metric Object ---
        const buildStratifiedMetric = (name: string): StratifiedMetric | null => {
            const overall = stat.metrics.find((m) => m.metricName === name && m.groupKey === null)
            const byGroup = stat.metrics
                .filter((m) => m.metricName === name && m.groupKey !== null)
                .reduce(
                    (acc, m) => {
                        acc[m.groupKey!] = {
                            value: m.value,
                            ciLower: m.ciLower,
                            ciUpper: m.ciUpper,
                            nSamples: m.nSamples,
                            reliability: {
                                code: m.reliabilityCode as ReliabilityCode,
                                message: m.reliabilityMessage,
                            },
                        }
                        return acc
                    },
                    {} as Record<number, MetricResult>
                )

            if (!overall && Object.keys(byGroup).length === 0) return null

            return {
                metricName: name,
                overall: overall
                    ? {
                          value: overall.value,
                          ciLower: overall.ciLower,
                          ciUpper: overall.ciUpper,
                          nSamples: overall.nSamples,
                          reliability: {
                              code: overall.reliabilityCode as ReliabilityCode,
                              message: overall.reliabilityMessage,
                          },
                      }
                    : {
                          value: 0,
                          ciLower: 0,
                          ciUpper: 0,
                          nSamples: 0,
                          reliability: { code: 'LOW_N', message: 'No data' },
                      },
                byGroup,
            }
        }

        // --- Build Data ---
        const solvability = buildStratifiedMetric('Solvability')
        if (!solvability) continue // Should not happen if data is valid

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

        stockMap.set(modelName, {
            solvability,
            ...(topKAccuracy && { topKAccuracy }),
        })
    }

    // Convert the final Map to a serializable array of tuples before returning
    return Array.from(result.entries()).map(([stockId, modelMap]) => [stockId, Array.from(modelMap.entries())])
}

/**
 * Cached version of getStratifiedMetrics.
 * Prevents re-aggregation on every request.
 */
export const getStratifiedMetrics = unstable_cache(_getStratifiedMetrics, ['stratified-metrics'], {
    tags: ['leaderboard', 'metrics'],
    revalidate: 3600, // Example: revalidate every hour
})

/**
 * Get rank probability distribution for a model run.
 * Parsing JSON is unavoidable here, but this is usually a drill-down detail.
 */
export async function getModelRankDistribution(
    runId: string,
    stockId: string
): Promise<{
    rankDistribution: Array<{ rank: number; probability: number }>
    expectedRank?: number
}> {
    const stats = await prisma.modelRunStatistics.findUnique({
        where: {
            predictionRunId_stockId: {
                predictionRunId: runId,
                stockId,
            },
        },
    })

    if (!stats) {
        throw new Error('Statistics not found for this run and stock.')
    }

    try {
        const parsedStats = JSON.parse(stats.statisticsJson) as Record<string, unknown>
        return {
            rankDistribution: (parsedStats.rankDistribution as Array<{ rank: number; probability: number }>) || [],
            expectedRank: parsedStats.expectedRank as number | undefined,
        }
    } catch {
        throw new Error('Failed to parse statistics JSON.')
    }
}
