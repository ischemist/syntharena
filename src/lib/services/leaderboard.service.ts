/**
 * Leaderboard Service
 *
 * Provides comparison functions for displaying model performance across benchmarks.
 * Used by leaderboard UI to show statistical comparisons and stratified metrics.
 */

import type { LeaderboardEntry, MetricResult, ReliabilityCode, StratifiedMetric } from '@/types'
import prisma from '@/lib/db'

// ============================================================================
// Core Read Functions
// ============================================================================

/**
 * Get leaderboard data for all models with optional filters.
 *
 * @param benchmarkId - Optional: Filter by benchmark
 * @param stockId - Optional: Filter by stock
 * @returns Array of leaderboard entries for comparison
 */
export async function getLeaderboard(benchmarkId?: string, stockId?: string): Promise<LeaderboardEntry[]> {
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
                    modelInstance: {
                        include: {
                            algorithm: true,
                        },
                    },
                    benchmarkSet: true,
                },
            },
            metrics: true,
        },
        orderBy: [
            {
                predictionRun: {
                    benchmarkSet: {
                        name: 'asc',
                    },
                },
            },
            {
                predictionRun: {
                    modelInstance: {
                        name: 'asc',
                    },
                },
            },
        ],
    })

    // Transform to leaderboard entries
    const entries: LeaderboardEntry[] = statistics.map((stat) => {
        // Get overall solvability metric
        const solvabilityMetric = stat.metrics.find(
            (m: (typeof stat.metrics)[0]) => m.metricName === 'Solvability' && m.groupKey === null
        )

        const solvability: MetricResult = solvabilityMetric
            ? {
                  value: solvabilityMetric.value,
                  ciLower: solvabilityMetric.ciLower,
                  ciUpper: solvabilityMetric.ciUpper,
                  nSamples: solvabilityMetric.nSamples,
                  reliability: {
                      code: solvabilityMetric.reliabilityCode,
                      message: solvabilityMetric.reliabilityMessage,
                  },
              }
            : {
                  value: 0,
                  ciLower: 0,
                  ciUpper: 0,
                  nSamples: 0,
                  reliability: { code: 'LOW_N', message: 'No data' },
              }

        // Get top-k accuracy metrics (only if benchmark has ground truth)
        const topKAccuracy: Record<string, MetricResult> = {}
        if (stat.predictionRun.benchmarkSet.hasGroundTruth) {
            const topKMetricNames = [
                ...new Set(
                    stat.metrics
                        .filter((m: (typeof stat.metrics)[0]) => m.metricName.startsWith('Top-') && m.groupKey === null)
                        .map((m: (typeof stat.metrics)[0]) => m.metricName)
                ),
            ]

            for (const metricName of topKMetricNames) {
                const metric = stat.metrics.find(
                    (m: (typeof stat.metrics)[0]) => m.metricName === metricName && m.groupKey === null
                )

                if (metric) {
                    topKAccuracy[metricName] = {
                        value: metric.value,
                        ciLower: metric.ciLower,
                        ciUpper: metric.ciUpper,
                        nSamples: metric.nSamples,
                        reliability: {
                            code: metric.reliabilityCode,
                            message: metric.reliabilityMessage,
                        },
                    }
                }
            }
        }

        return {
            modelName: stat.predictionRun.modelInstance.name,
            benchmarkName: stat.predictionRun.benchmarkSet.name,
            stockName: stat.stock.name,
            metrics: {
                solvability,
                ...(Object.keys(topKAccuracy).length > 0 && { topKAccuracy }),
            },
        }
    })

    return entries
}

/**
 * Get stratified metric breakdown by route length for comparison.
 *
 * @param benchmarkId - The benchmark ID
 * @param stockId - The stock ID
 * @param metricName - The metric name (e.g., "Solvability", "Top-1")
 * @returns Map of route length to map of model name to metric result
 */
export async function getStratifiedComparison(
    benchmarkId: string,
    stockId: string,
    metricName: string
): Promise<Map<number, Map<string, MetricResult>>> {
    // Fetch all statistics for this benchmark + stock
    const statistics = await prisma.modelRunStatistics.findMany({
        where: {
            stockId,
            predictionRun: {
                benchmarkSetId: benchmarkId,
            },
        },
        include: {
            predictionRun: {
                include: {
                    modelInstance: true,
                },
            },
            metrics: {
                where: {
                    metricName,
                    groupKey: { not: null }, // Only stratified metrics
                },
            },
        },
    })

    // Build nested map: routeLength -> modelName -> MetricResult
    const comparisonMap = new Map<number, Map<string, MetricResult>>()

    for (const stat of statistics) {
        const modelName = stat.predictionRun.modelInstance.name

        for (const metric of stat.metrics) {
            if (metric.groupKey === null) continue

            const routeLength = metric.groupKey
            if (!comparisonMap.has(routeLength)) {
                comparisonMap.set(routeLength, new Map())
            }

            const modelMap = comparisonMap.get(routeLength)!
            modelMap.set(modelName, {
                value: metric.value,
                ciLower: metric.ciLower,
                ciUpper: metric.ciUpper,
                nSamples: metric.nSamples,
                reliability: {
                    code: metric.reliabilityCode,
                    message: metric.reliabilityMessage,
                },
            })
        }
    }

    return comparisonMap
}

/**
 * Get rank probability distribution for a model run.
 *
 * @param runId - The prediction run ID
 * @param stockId - The stock ID
 * @returns Rank distribution and expected rank
 */
export async function getModelRankDistribution(
    runId: string,
    stockId: string
): Promise<{
    rankDistribution: Array<{ rank: number; probability: number }>
    expectedRank?: number
}> {
    // Fetch statistics
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

    // Parse JSON to get rank distribution
    let parsedStats: Record<string, unknown>
    try {
        parsedStats = JSON.parse(stats.statisticsJson) as Record<string, unknown>
    } catch {
        throw new Error('Failed to parse statistics JSON.')
    }

    return {
        rankDistribution: (parsedStats.rankDistribution as Array<{ rank: number; probability: number }>) || [],
        expectedRank: parsedStats.expectedRank as number | undefined,
    }
}

/**
 * Get leaderboard data grouped by benchmark.
 * Returns a map of benchmark IDs to their leaderboard entries.
 *
 * @param stockId - Optional: Filter by stock
 * @returns Map of benchmark ID to array of leaderboard entries for that benchmark
 */
export async function getLeaderboardByBenchmark(stockId?: string): Promise<
    Map<
        string,
        {
            benchmarkId: string
            benchmarkName: string
            hasGroundTruth: boolean
            entries: LeaderboardEntry[]
        }
    >
> {
    // Get all entries, optionally filtered by stock
    const allEntries = await getLeaderboard(undefined, stockId)

    // Group by benchmark
    const grouped = new Map<
        string,
        {
            benchmarkId: string
            benchmarkName: string
            hasGroundTruth: boolean
            entries: LeaderboardEntry[]
        }
    >()

    // Get all unique benchmark names
    const benchmarkNames = [...new Set(allEntries.map((entry) => entry.benchmarkName))]

    // Fetch all relevant benchmarks in one query
    const benchmarks = await prisma.benchmarkSet.findMany({
        where: { name: { in: benchmarkNames } },
        select: { id: true, name: true, hasGroundTruth: true },
    })

    // Create a map for easy lookup
    const benchmarkMap = new Map(benchmarks.map((b) => [b.name, b]))

    for (const entry of allEntries) {
        const benchmark = benchmarkMap.get(entry.benchmarkName)
        if (!benchmark) continue

        if (!grouped.has(entry.benchmarkName)) {
            grouped.set(entry.benchmarkName, {
                benchmarkId: benchmark.id,
                benchmarkName: benchmark.name,
                hasGroundTruth: benchmark.hasGroundTruth,
                entries: [],
            })
        }

        // Add entry to the group
        const group = grouped.get(entry.benchmarkName)
        if (group) {
            group.entries.push(entry)
        }
    }

    return grouped
}

/**
 * Get all metrics for a specific benchmark-stock combination.
 * Returns metrics grouped by model for easy table display.
 *
 * @param benchmarkId - The benchmark ID
 * @param stockId - The stock ID
 * @returns Map of model name to all metrics (overall and stratified)
 */
export async function getMetricsByBenchmarkAndStock(
    benchmarkId: string,
    stockId: string
): Promise<
    Map<
        string,
        {
            solvability: StratifiedMetric
            topKAccuracy?: Record<string, StratifiedMetric>
        }
    >
> {
    // Fetch all statistics for this combination
    const statistics = await prisma.modelRunStatistics.findMany({
        where: {
            stockId,
            predictionRun: {
                benchmarkSetId: benchmarkId,
            },
        },
        include: {
            predictionRun: {
                include: {
                    modelInstance: true,
                    benchmarkSet: true,
                },
            },
            metrics: true,
        },
    })

    const metricsMap = new Map<
        string,
        {
            solvability: StratifiedMetric
            topKAccuracy?: Record<string, StratifiedMetric>
        }
    >()

    for (const stat of statistics) {
        const modelName = stat.predictionRun.modelInstance.name

        // Build solvability metric
        const solvabilityOverall = stat.metrics.find(
            (m: (typeof stat.metrics)[0]) => m.metricName === 'Solvability' && m.groupKey === null
        )
        const solvabilityByGroup = stat.metrics
            .filter((m: (typeof stat.metrics)[0]) => m.metricName === 'Solvability' && m.groupKey !== null)
            .reduce(
                (acc: Record<number, MetricResult>, m: (typeof stat.metrics)[0]) => {
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

        const solvability: StratifiedMetric = {
            metricName: 'Solvability',
            overall: solvabilityOverall
                ? {
                      value: solvabilityOverall.value,
                      ciLower: solvabilityOverall.ciLower,
                      ciUpper: solvabilityOverall.ciUpper,
                      nSamples: solvabilityOverall.nSamples,
                      reliability: {
                          code: solvabilityOverall.reliabilityCode,
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

        // Build top-k metrics if benchmark has ground truth
        let topKAccuracy: Record<string, StratifiedMetric> | undefined
        if (stat.predictionRun.benchmarkSet.hasGroundTruth) {
            const topKNames = [
                ...new Set(
                    stat.metrics
                        .filter((m: (typeof stat.metrics)[0]) => m.metricName.startsWith('Top-'))
                        .map((m: (typeof stat.metrics)[0]) => m.metricName)
                ),
            ]

            topKAccuracy = {}
            for (const metricName of topKNames) {
                const overall = stat.metrics.find(
                    (m: (typeof stat.metrics)[0]) => m.metricName === metricName && m.groupKey === null
                )
                const byGroup = stat.metrics
                    .filter((m: (typeof stat.metrics)[0]) => m.metricName === metricName && m.groupKey !== null)
                    .reduce(
                        (acc: Record<number, MetricResult>, m: (typeof stat.metrics)[0]) => {
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

                if (overall) {
                    topKAccuracy[metricName] = {
                        metricName,
                        overall: {
                            value: overall.value,
                            ciLower: overall.ciLower,
                            ciUpper: overall.ciUpper,
                            nSamples: overall.nSamples,
                            reliability: {
                                code: overall.reliabilityCode,
                                message: overall.reliabilityMessage,
                            },
                        },
                        byGroup,
                    }
                }
            }

            if (Object.keys(topKAccuracy).length === 0) {
                topKAccuracy = undefined
            }
        }

        metricsMap.set(modelName, {
            solvability,
            ...(topKAccuracy && { topKAccuracy }),
        })
    }

    return metricsMap
}
