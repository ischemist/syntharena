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
                    name: true,
                    versionMajor: true,
                    versionMinor: true,
                    versionPatch: true,
                    versionPrerelease: true,
                    algorithm: { select: { name: true } },
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
            modelName: run.modelInstance.name,
            modelVersion: versionString,
            algorithmName: run.modelInstance.algorithm.name,
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
