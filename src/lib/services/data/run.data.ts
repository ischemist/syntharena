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

/**
 * returns data needed for the main prediction run list.
 * supports developer mode filtering: when devMode is false, returns only the
 * "champion" (best-performing) run for each (model family, benchmark) combination.
 * champion is determined by Top-10 accuracy, falling back to Solvability.
 */
async function _findPredictionRunsForList(where: Prisma.PredictionRunWhereInput, devMode: boolean = false) {
    const allRuns = await prisma.predictionRun.findMany({
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
                    modelFamilyId: true,
                    slug: true,
                    versionMajor: true,
                    versionMinor: true,
                    versionPatch: true,
                    versionPrerelease: true,
                    createdAt: true,
                    family: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            description: true,
                            algorithmId: true,
                            algorithm: { select: { id: true, name: true, slug: true } },
                        },
                    },
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
                        where: {
                            groupKey: null,
                            metricName: { in: ['Solvability', 'Top-1', 'Top-10'] },
                        },
                        select: {
                            metricName: true,
                            value: true,
                            ciLower: true,
                            ciUpper: true,
                            nSamples: true,
                            reliabilityCode: true,
                            reliabilityMessage: true,
                        },
                    },
                },
            },
        },
        orderBy: { executedAt: 'desc' },
    })

    // if in developer mode, return all runs
    if (devMode) {
        return allRuns
    }

    // otherwise, apply champion filtering: keep only the best-performing run
    // for each (model family, benchmark) combination
    const runsByCompositeKey = new Map<string, typeof allRuns>()
    for (const run of allRuns) {
        // group by both family and benchmark to ensure we get champions per benchmark
        const compositeKey = `${run.modelInstance.family.id}-${run.benchmarkSetId}`
        if (!runsByCompositeKey.has(compositeKey)) {
            runsByCompositeKey.set(compositeKey, [])
        }
        runsByCompositeKey.get(compositeKey)!.push(run)
    }

    // for each group, select the champion based on metric performance
    const champions: typeof allRuns = []
    for (const [, groupRuns] of runsByCompositeKey) {
        // helper to extract a metric value from a run
        const getMetric = (run: (typeof groupRuns)[0], metricName: string): number => {
            return run.statistics[0]?.metrics.find((m) => m.metricName === metricName)?.value ?? -1
        }

        // find the champion using the same logic as leaderboard
        const champion = groupRuns.reduce((best, current) => {
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

        champions.push(champion)
    }

    return champions
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
            modelInstance: { include: { family: { include: { algorithm: true } } } },
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
            modelInstance: { select: { family: { select: { name: true } } } },
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
                    slug: true,
                    versionMajor: true,
                    versionMinor: true,
                    versionPatch: true,
                    versionPrerelease: true,
                    family: {
                        select: {
                            name: true,
                            algorithm: { select: { name: true } },
                        },
                    },
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
            modelInstance: { select: { family: { select: { name: true } } } },
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
