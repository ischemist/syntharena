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
