/**
 * data access layer for statistics models.
 * handles `ModelRunStatistics` and `StratifiedMetricGroup`.
 */
import { unstable_cache as cache } from 'next/cache'
import { Prisma } from '@prisma/client'

import prisma from '@/lib/db'

/**
 * fetches all statistics records matching the leaderboard filters.
 * includes all relations needed to build the leaderboard view.
 */
async function _findStatisticsForLeaderboard(where: Prisma.ModelRunStatisticsWhereInput) {
    return prisma.modelRunStatistics.findMany({
        where,
        include: {
            stock: true,
            predictionRun: {
                include: {
                    benchmarkSet: true,
                    modelInstance: {
                        include: {
                            family: true,
                        },
                    },
                },
            },
            metrics: true,
        },
        orderBy: [
            { predictionRun: { benchmarkSet: { name: 'asc' } } },
            { predictionRun: { modelInstance: { family: { name: 'asc' } } } },
            { predictionRun: { modelInstance: { versionMajor: 'desc' } } },
        ],
    })
}
export const findStatisticsForLeaderboard = cache(_findStatisticsForLeaderboard, ['stats-for-leaderboard'], {
    tags: ['statistics', 'leaderboard'],
})

/**
 * fetches the raw JSON blob for a specific run/stock combination.
 * used for detailed views like rank distribution plots.
 */
async function _findStatisticsJson(runId: string, stockId: string) {
    const stats = await prisma.modelRunStatistics.findUnique({
        where: {
            predictionRunId_stockId: { predictionRunId: runId, stockId },
        },
        select: { statisticsJson: true },
    })
    if (!stats) throw new Error('statistics not found for this run and stock.')
    return stats
}
export const findStatisticsJson = cache(_findStatisticsJson, ['stats-json-by-id'], {
    tags: ['statistics'],
})

/**
 * fetches all stocks that have statistics for a given run.
 * used to populate the stock selector on run detail pages.
 */
async function _findStocksWithStatsForRun(runId: string) {
    return prisma.modelRunStatistics.findMany({
        where: { predictionRunId: runId },
        select: {
            stock: {
                select: {
                    id: true,
                    name: true,
                    description: true,
                    _count: { select: { items: true } },
                },
            },
        },
        orderBy: { stock: { name: 'asc' } },
    })
}
export const findStocksWithStatsForRun = cache(_findStocksWithStatsForRun, ['stocks-with-stats-for-run'], {
    tags: ['statistics', 'stocks'],
})

/**
 * fetches full statistics for a run/stock combination with metrics.
 * used for detailed statistics views.
 */
async function _findStatisticsForRun(runId: string, stockId: string) {
    const stats = await prisma.modelRunStatistics.findUnique({
        where: {
            predictionRunId_stockId: { predictionRunId: runId, stockId },
        },
        include: {
            stock: true,
            metrics: true,
        },
    })
    if (!stats) throw new Error('statistics not found for this run and stock.')
    return stats
}
export const findStatisticsForRun = cache(_findStatisticsForRun, ['stats-for-run'], {
    tags: ['statistics'],
})

/**
 * Finds the best (max value) metrics for an algorithm's model instances on specified benchmarks.
 * Returns the best Top-K accuracy per (benchmark, metric) combination with the achieving model instance.
 * Only considers overall metrics (groupKey === null).
 */
async function _findBestMetricsForAlgorithm(algorithmId: string, benchmarkIds: string[], metricNames: string[]) {
    if (benchmarkIds.length === 0 || metricNames.length === 0) return []

    const metrics = await prisma.stratifiedMetricGroup.findMany({
        where: {
            metricName: { in: metricNames },
            groupKey: null, // overall metrics only
            statistics: {
                benchmarkSetId: { in: benchmarkIds },
                predictionRun: {
                    modelInstance: { family: { algorithmId } },
                },
            },
        },
        select: {
            metricName: true,
            value: true,
            ciLower: true,
            ciUpper: true,
            statistics: {
                select: {
                    benchmarkSetId: true,
                    predictionRun: {
                        select: {
                            benchmarkSet: { select: { name: true } },
                            modelInstance: {
                                select: {
                                    slug: true,
                                    versionMajor: true,
                                    versionMinor: true,
                                    versionPatch: true,
                                    versionPrerelease: true,
                                    family: { select: { name: true } },
                                },
                            },
                        },
                    },
                },
            },
        },
        orderBy: { value: 'desc' },
    })
    // a simple filter to remove duplicates if the same instance has multiple stats for the same metric (e.g. diff stocks)
    // we only care about the best performance overall.
    const uniqueMetrics = new Map<string, (typeof metrics)[0]>()
    for (const metric of metrics) {
        const key = `${metric.statistics.predictionRun.modelInstance.slug}:${metric.metricName}:${metric.statistics.benchmarkSetId}`
        if (!uniqueMetrics.has(key)) {
            uniqueMetrics.set(key, metric)
        }
    }
    return Array.from(uniqueMetrics.values())
}
export const findBestMetricsForAlgorithm = cache(_findBestMetricsForAlgorithm, ['best-metrics-for-algorithm'], {
    tags: ['statistics', 'algorithms', 'models'],
})
export type BestMetricPayload = Prisma.PromiseReturnType<typeof _findBestMetricsForAlgorithm>[0]
