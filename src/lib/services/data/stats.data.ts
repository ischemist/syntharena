/** Data access for canonical RetroCast run evaluations and metric estimates. */
import { unstable_cache as cache } from 'next/cache'
import { Prisma } from '@prisma/client'

import prisma from '@/lib/db'

/**
 * Keep the leaderboard query result limited to fields rendered by the view.
 * RunEvaluation and BenchmarkSet contain large artifact/constraint JSON blobs;
 * selecting either model wholesale can exceed Next.js' 2 MiB data-cache limit.
 */
export const leaderboardStatisticsSelect = {
    id: true,
    metricLabel: true,
    stock: { select: { name: true } },
    predictionRun: {
        select: {
            id: true,
            benchmarkSetId: true,
            submissionType: true,
            isRetrained: true,
            totalWallTime: true,
            totalCost: true,
            benchmarkSet: {
                select: {
                    name: true,
                    hasAcceptableRoutes: true,
                    series: true,
                },
            },
            modelInstance: {
                select: {
                    slug: true,
                    versionMajor: true,
                    versionMinor: true,
                    versionPatch: true,
                    versionPrerelease: true,
                    family: {
                        select: {
                            id: true,
                            name: true,
                            algorithm: { select: { name: true, slug: true } },
                        },
                    },
                },
            },
        },
    },
    metrics: {
        where: {
            OR: [
                { metricKey: 'tier_0_validity_rate' },
                { metricKey: { startsWith: 'solv_0[', endsWith: ']_rate' } },
                { metricKey: { startsWith: 'acceptable_reconstruction_top_' } },
            ],
        },
        select: {
            metricKey: true,
            stratum: true,
            value: true,
            ciLower: true,
            ciUpper: true,
            nSamples: true,
            reliabilityCode: true,
            reliabilityMessage: true,
        },
    },
} satisfies Prisma.RunEvaluationSelect

/**
 * This result grows with the number of evaluations in a benchmark, so it must
 * not use Next.js' size-limited data cache. The database is immutable in the
 * deployed app and this indexed, projected SQLite query is inexpensive.
 */
export async function findStatisticsForLeaderboard(where: Prisma.RunEvaluationWhereInput) {
    return prisma.runEvaluation.findMany({
        where,
        select: leaderboardStatisticsSelect,
        orderBy: [
            { predictionRun: { benchmarkSet: { name: 'asc' } } },
            { predictionRun: { modelInstance: { family: { name: 'asc' } } } },
            { predictionRun: { modelInstance: { versionMajor: 'desc' } } },
        ],
    })
}

async function _findEvaluationsForRun(runId: string) {
    return prisma.runEvaluation.findMany({
        where: { predictionRunId: runId },
        select: {
            id: true,
            metricLabel: true,
            stock: {
                select: {
                    id: true,
                    name: true,
                    description: true,
                    _count: { select: { items: true } },
                },
            },
        },
        orderBy: { metricLabel: 'asc' },
    })
}
export const findEvaluationsForRun = cache(_findEvaluationsForRun, ['evaluations-for-run-v3'], {
    tags: ['statistics', 'stocks'],
})

async function _findStatisticsForRun(runId: string, evaluationId: string) {
    const evaluation = await prisma.runEvaluation.findFirst({
        where: { id: evaluationId, predictionRunId: runId },
        include: { stock: true, metrics: true },
    })
    if (!evaluation) throw new Error('evaluation not found for this run.')
    return evaluation
}
export const findStatisticsForRun = cache(_findStatisticsForRun, ['stats-for-run-v3'], { tags: ['statistics'] })

async function _findEvaluationContext(runId: string, evaluationId: string) {
    const evaluation = await prisma.runEvaluation.findFirst({
        where: { id: evaluationId, predictionRunId: runId },
        select: { id: true, metricLabel: true, stock: { select: { id: true, name: true } } },
    })
    if (!evaluation) throw new Error('evaluation not found for this run.')
    return evaluation
}
export const findEvaluationContext = cache(_findEvaluationContext, ['evaluation-context-v3'], {
    tags: ['statistics', 'stocks'],
})

async function _findBestMetricsForAlgorithm(algorithmId: string, benchmarkIds: string[], metricNames: string[]) {
    if (benchmarkIds.length === 0 || metricNames.length === 0) return []
    const metrics = await prisma.metricEstimate.findMany({
        where: {
            metricKey: { in: metricNames },
            stratum: '',
            runEvaluation: {
                predictionRun: {
                    benchmarkSetId: { in: benchmarkIds },
                    modelInstance: { family: { algorithmId } },
                },
            },
        },
        select: {
            metricKey: true,
            value: true,
            ciLower: true,
            ciUpper: true,
            runEvaluation: {
                select: {
                    predictionRun: {
                        select: {
                            benchmarkSetId: true,
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
    const unique = new Map<string, (typeof metrics)[number]>()
    for (const metric of metrics) {
        const run = metric.runEvaluation.predictionRun
        const key = `${run.modelInstance.slug}:${metric.metricKey}:${run.benchmarkSetId}`
        if (!unique.has(key)) unique.set(key, metric)
    }
    return [...unique.values()]
}
export const findBestMetricsForAlgorithm = cache(_findBestMetricsForAlgorithm, ['best-metrics-for-algorithm-v2'], {
    tags: ['statistics', 'algorithms', 'models'],
})
export type BestMetricPayload = Prisma.PromiseReturnType<typeof _findBestMetricsForAlgorithm>[0]
