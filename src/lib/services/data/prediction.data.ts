/**
 * data access layer for prediction models.
 */
import { unstable_cache as cache } from 'next/cache'
import { Prisma } from '@prisma/client'

import prisma from '@/lib/db'

/** fetches prediction run info for a target, aggregated from its prediction routes. */
async function _findPredictionRunsForTarget(targetId: string) {
    const runsWithPredictions = await prisma.predictionRun.findMany({
        where: { predictionRoutes: { some: { targetId: targetId } } },
        select: {
            id: true,
            executedAt: true,
            modelInstance: {
                select: {
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
            _count: {
                select: { predictionRoutes: { where: { targetId } } },
            },
        },
        orderBy: { executedAt: 'desc' },
    })

    // Fetch max ranks in a separate, efficient query
    const runIds = runsWithPredictions.map((r) => r.id)
    const maxRanks = await prisma.predictionRoute.groupBy({
        by: ['predictionRunId'],
        where: { predictionRunId: { in: runIds }, targetId },
        _max: { rank: true },
    })
    const maxRankMap = new Map(maxRanks.map((r) => [r.predictionRunId, r._max.rank]))

    return runsWithPredictions.map((run) => {
        const { versionMajor, versionMinor, versionPatch, versionPrerelease } = run.modelInstance
        let versionString = `v${versionMajor}.${versionMinor}.${versionPatch}`
        if (versionPrerelease) {
            versionString += `-${versionPrerelease}`
        }
        return {
            id: run.id,
            modelName: run.modelInstance.family.name,
            modelVersion: versionString,
            algorithmName: run.modelInstance.family.algorithm.name,
            executedAt: run.executedAt,
            routeCount: run._count.predictionRoutes,
            maxRank: maxRankMap.get(run.id) || 0,
        }
    })
}
export const findPredictionRunsForTarget = cache(_findPredictionRunsForTarget, ['runs-for-target'], {
    tags: ['runs', 'targets', 'routes'],
})

/** fetches the raw nodes for a predicted route. does not build the tree. */
async function _findPredictedRouteNodes(targetId: string, runId: string, rank: number) {
    const prediction = await prisma.predictionRoute.findFirst({
        where: { targetId, predictionRunId: runId, rank },
        select: {
            route: {
                select: {
                    nodes: { include: { molecule: true } },
                },
            },
        },
    })
    return prediction?.route.nodes ?? null
}
export const findPredictedRouteNodes = cache(_findPredictedRouteNodes, ['predicted-route-nodes'], {
    tags: ['routes', 'targets', 'runs'],
})
export type RouteNodeWithMoleculePayload = NonNullable<Prisma.PromiseReturnType<typeof _findPredictedRouteNodes>>

/**
 * finds benchmark targets for a run and counts the number of predicted routes for each.
 * optimized for the target search component on the run detail page.
 */
async function _findTargetsAndPredictionCountsForRun(
    runId: string,
    where: Prisma.BenchmarkTargetWhereInput,
    limit: number
) {
    // first, get the benchmarkId from the run
    const run = await prisma.predictionRun.findUnique({
        where: { id: runId },
        select: { benchmarkSetId: true },
    })
    if (!run) throw new Error('run not found.')

    // find the paginated targets for that benchmark matching the where clause
    const targets = await prisma.benchmarkTarget.findMany({
        where: { ...where, benchmarkSetId: run.benchmarkSetId },
        include: { molecule: true },
        orderBy: { targetId: 'asc' },
        take: limit,
    })

    // now, efficiently count the predictions for ONLY these targets in this specific run
    const targetIds = targets.map((t) => t.id)
    const counts =
        targetIds.length > 0
            ? await prisma.predictionRoute.groupBy({
                  by: ['targetId'],
                  where: {
                      predictionRunId: runId,
                      targetId: { in: targetIds },
                  },
                  _count: { _all: true },
              })
            : []

    return { targets, counts }
}
export const findTargetsAndPredictionCountsForRun = cache(
    _findTargetsAndPredictionCountsForRun,
    ['targets-and-prediction-counts-for-run'],
    { tags: ['targets', 'runs'] }
)
