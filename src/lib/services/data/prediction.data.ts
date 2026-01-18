/**
 * data access layer for prediction models.
 */
import { unstable_cache as cache } from 'next/cache'
import { buildRouteTree } from '@/lib/tree-builder/route-tree'
import prisma from '@/lib/db'

/** fetches prediction run info for a target, aggregated from its prediction routes. */
async function _findPredictionRunsForTarget(targetId: string) {
    // This query is complex because we need to find all runs that have *any* prediction for a target,
    // and for each of those runs, find the max rank.
    const runsWithPredictions = await prisma.predictionRun.findMany({
        where: {
            predictionRoutes: {
                some: {
                    targetId: targetId,
                },
            },
        },
        select: {
            id: true,
            executedAt: true,
            modelInstance: {
                select: {
                    name: true,
                    version: true,
                    algorithm: { select: { name: true } },
                },
            },
            // We need to query the routes separately to aggregate rank and count.
            predictionRoutes: {
                where: { targetId: targetId },
                select: { rank: true },
            },
        },
        orderBy: { executedAt: 'desc' },
    })

    // Process in JS to get the DTO shape
    return runsWithPredictions.map((run) => ({
        id: run.id,
        modelName: run.modelInstance.name,
        modelVersion: run.modelInstance.version || undefined,
        algorithmName: run.modelInstance.algorithm.name,
        executedAt: run.executedAt,
        routeCount: run.predictionRoutes.length,
        maxRank: run.predictionRoutes.length > 0 ? Math.max(...run.predictionRoutes.map((r) => r.rank)) : 0,
    }))
}
export const findPredictionRunsForTarget = cache(_findPredictionRunsForTarget, ['runs-for-target'], {
    tags: ['runs', 'targets', 'routes'],
})

// you'll also need the getPredictedRouteForTarget function. move it here from route.data.ts
async function _getPredictedRouteForTarget(targetId: string, runId: string, rank: number) {
    const prediction = await prisma.predictionRoute.findFirst({
        where: { targetId, predictionRunId: runId, rank },
        include: {
            route: {
                include: {
                    nodes: { include: { molecule: true } },
                },
            },
        },
    })
    if (!prediction) return null
    return buildRouteTree(prediction.route.nodes)
}
export const getPredictedRouteForTarget = cache(_getPredictedRouteForTarget, ['predicted-route-for-target'], {
    tags: ['routes', 'targets', 'runs'],
})
