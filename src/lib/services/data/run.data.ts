/**
 * data access layer for prediction run models.
 * handles `PredictionRun`, `ModelInstance`, and `Algorithm`.
 */
import { unstable_cache as cache } from 'next/cache'
import { Prisma } from '@prisma/client'

import prisma from '@/lib/db'
import { solvRateKey, topKFromMetricKey } from '@/lib/retrocast-metrics'

// ============================================================================
// reads
// ============================================================================

/**
 * returns data needed for the main prediction run list.
 * supports developer mode filtering: when devMode is false, returns only the
 * "champion" (best-performing) run for each (model family, benchmark) combination.
 * champion is determined by Top-10 accuracy, falling back to exact-label Solv-0.
 */
async function _findPredictionRunsForList(where: Prisma.PredictionRunWhereInput, devMode: boolean = false) {
    const allRuns = await prisma.predictionRun.findMany({
        where,
        select: {
            id: true,
            modelInstanceId: true,
            benchmarkSetId: true,
            totalRoutes: true,
            totalWallTime: true,
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
            evaluations: {
                select: {
                    stockId: true,
                    metricLabel: true,
                    metrics: {
                        where: { stratum: '' },
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
        const groupRunsWithMetrics = groupRuns.map((run) => ({
            run,
            metricsByName: new Map(
                (run.evaluations[0]?.metrics ?? []).map((metric) => [metric.metricKey, metric.value])
            ),
        }))

        // helper to extract a metric value from a run
        const getMetric = (entry: (typeof groupRunsWithMetrics)[0], metricName: string): number =>
            entry.metricsByName.get(metricName) ?? -1

        // find the champion using the same logic as leaderboard
        const champion = groupRunsWithMetrics.reduce((best, current) => {
            const top10Key = [...current.metricsByName.keys()].find((key) => topKFromMetricKey(key) === 10)
            const bestTop10 = top10Key ? getMetric(best, top10Key) : -1
            const currentTop10 = top10Key ? getMetric(current, top10Key) : -1

            // if top-10 exists, it's the primary sorting key
            if (bestTop10 !== -1 || currentTop10 !== -1) {
                return currentTop10 > bestTop10 ? current : best
            }

            const bestLabel = best.run.evaluations[0]?.metricLabel
            const currentLabel = current.run.evaluations[0]?.metricLabel
            const bestSolv0 = bestLabel ? getMetric(best, solvRateKey(0, bestLabel)) : -1
            const currentSolv0 = currentLabel ? getMetric(current, solvRateKey(0, currentLabel)) : -1
            return currentSolv0 > bestSolv0 ? current : best
        })

        champions.push(champion.run)
    }

    return champions
}
export const findPredictionRunsForList = cache(_findPredictionRunsForList, ['prediction-run-list'], {
    tags: ['runs'],
})

/** returns all data for a single prediction run detail page. */
async function _findPredictionRunDetailsById(runId: string) {
    const run = await prisma.predictionRun.findUnique({
        where: { id: runId },
        include: {
            modelInstance: { include: { family: { include: { algorithm: true } } } },
            benchmarkSet: true,
            evaluations: {
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
            totalWallTime: true,
            modelInstance: { select: { family: { select: { name: true } } } },
            benchmarkSet: { select: { id: true, name: true, hasAcceptableRoutes: true } },
        },
    })
    if (!run) throw new Error('prediction run not found.')
    return run
}

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
