/**
 * data access layer for prediction run models.
 * handles `PredictionRun`, `ModelInstance`, and `Algorithm`.
 */
import { unstable_cache as cache } from 'next/cache'
import { Prisma } from '@prisma/client'

import prisma from '@/lib/db'

// ============================================================================
// reads
// ============================================================================

/** returns data needed for the main prediction run list. */
async function _findPredictionRunsForList(where: Prisma.PredictionRunWhereInput) {
    return prisma.predictionRun.findMany({
        where,
        select: {
            id: true,
            modelInstanceId: true,
            benchmarkSetId: true,
            totalRoutes: true,
            hourlyCost: true,
            totalCost: true,
            avgRouteLength: true,
            executedAt: true,
            submissionType: true,
            isRetrained: true,
            modelInstance: {
                select: {
                    id: true,
                    algorithmId: true,
                    name: true,
                    slug: true,
                    versionMajor: true,
                    versionMinor: true,
                    versionPatch: true,
                    versionPrerelease: true,
                    algorithm: { select: { id: true, name: true } },
                },
            },
            benchmarkSet: {
                select: {
                    id: true,
                    name: true,
                    stockId: true,
                    createdAt: true,
                    hasAcceptableRoutes: true,
                    series: true,
                },
            },
            statistics: {
                select: {
                    stockId: true,
                    totalWallTime: true,
                    metrics: {
                        where: { metricName: 'Solvability', groupKey: null },
                        select: { value: true },
                    },
                },
            },
        },
        orderBy: { executedAt: 'desc' },
    })
}
export const findPredictionRunsForList = cache(_findPredictionRunsForList, ['prediction-run-list'], {
    tags: ['runs'],
})
export type PredictionRunListItemPayload = Prisma.PromiseReturnType<typeof _findPredictionRunsForList>[0]

/** returns all data for a single prediction run detail page. */
async function _findPredictionRunDetailsById(runId: string) {
    const run = await prisma.predictionRun.findUnique({
        where: { id: runId },
        include: {
            modelInstance: { include: { algorithm: true } },
            benchmarkSet: true,
            statistics: {
                include: { stock: true, metrics: true },
            },
        },
    })
    if (!run) throw new Error('prediction run not found.')
    return run
}
export const findPredictionRunDetailsById = cache(_findPredictionRunDetailsById, ['prediction-run-details-by-id'], {
    tags: ['runs'],
})

/** returns only the data needed for the run detail page header. */
async function _findPredictionRunHeaderById(runId: string) {
    const run = await prisma.predictionRun.findUnique({
        where: { id: runId },
        select: {
            id: true,
            totalRoutes: true,
            executedAt: true,
            totalCost: true,
            modelInstance: { select: { name: true } },
            benchmarkSet: { select: { id: true, name: true, hasAcceptableRoutes: true } },
            statistics: { select: { totalWallTime: true }, take: 1 }, // only need one stat record for wall time
        },
    })
    if (!run) throw new Error('prediction run not found.')
    return run
}
export const findPredictionRunHeaderById = cache(_findPredictionRunHeaderById, ['prediction-run-header-by-id'], {
    tags: ['runs'],
})

/** finds all runs for a specific benchmark, used in dropdowns. */
async function _findPredictionRunsForBenchmark(benchmarkId: string) {
    return prisma.predictionRun.findMany({
        where: { benchmarkSetId: benchmarkId },
        select: {
            id: true,
            totalRoutes: true,
            avgRouteLength: true,
            executedAt: true,
            modelInstance: {
                select: {
                    name: true,
                    version: true,
                    algorithm: { select: { name: true } },
                },
            },
        },
        orderBy: { executedAt: 'desc' },
    })
}
export const findPredictionRunsForBenchmark = cache(
    _findPredictionRunsForBenchmark,
    ['prediction-runs-for-benchmark'],
    { tags: ['runs', 'benchmarks'] }
)

/** returns only the data needed for the run detail breadcrumb. */
async function _findPredictionRunBreadcrumbData(runId: string) {
    const run = await prisma.predictionRun.findUnique({
        where: { id: runId },
        select: {
            modelInstance: { select: { name: true } },
            benchmarkSet: { select: { id: true, name: true } },
        },
    })
    if (!run) throw new Error('prediction run not found for breadcrumb.')
    return run
}
export const findPredictionRunBreadcrumbData = cache(
    _findPredictionRunBreadcrumbData,
    ['prediction-run-breadcrumb-data'],
    { tags: ['runs', 'benchmarks'] }
)
