/**
 * data access layer for route models.
 * handles `Route`, `RouteNode`, `PredictionRoute`, and `AcceptableRoute`.
 * these functions retrieve the raw components of a synthesis graph.
 */
import { unstable_cache as cache } from 'next/cache'
import { Prisma } from '@prisma/client'

import prisma from '@/lib/db'

// ============================================================================
// reads
// ============================================================================

/** fetches all nodes for a given route id. this is the primary way to get a route's structure. */
async function _findNodesForRoute(routeId: string) {
    return prisma.routeNode.findMany({
        where: { routeId },
        include: { molecule: true },
    })
}
export const findNodesForRoute = cache(_findNodesForRoute, ['nodes-for-route'], {
    tags: ['routes'],
})
export type RouteNodeWithMoleculePayload = Prisma.PromiseReturnType<typeof _findNodesForRoute>

/** fetches a specific predicted route with its full relational hierarchy. */
async function _findPredictedRouteForTarget(targetId: string, runId: string, rank: number) {
    return prisma.predictionRoute.findFirst({
        where: { targetId, predictionRunId: runId, rank },
        include: {
            route: {
                include: {
                    nodes: { include: { molecule: true } },
                },
            },
        },
    })
}
export const findPredictedRouteForTarget = cache(_findPredictedRouteForTarget, ['predicted-route-for-target'], {
    tags: ['routes', 'targets', 'runs'],
})

/** fetches all acceptable routes for a given target. */
async function _findAcceptableRoutesForTarget(targetId: string) {
    return prisma.acceptableRoute.findMany({
        where: { benchmarkTargetId: targetId },
        select: {
            routeIndex: true,
            route: {
                select: { id: true, signature: true, contentHash: true },
            },
        },
        orderBy: { routeIndex: 'asc' },
    })
}
export const findAcceptableRoutesForTarget = cache(_findAcceptableRoutesForTarget, ['acceptable-routes-for-target'], {
    tags: ['routes', 'targets'],
})

/**
 * fetches prediction run info for a target, aggregated from its prediction routes.
 * used to populate the model selector on the target page.
 */
async function _findPredictionRunsForTarget(targetId: string) {
    const predictionRoutes = await prisma.predictionRoute.findMany({
        where: { targetId },
        select: {
            rank: true,
            predictionRun: {
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
                },
            },
        },
        orderBy: {
            predictionRun: { executedAt: 'desc' },
        },
    })
    return predictionRoutes
}
export const findPredictionRunsForTarget = cache(_findPredictionRunsForTarget, ['runs-for-target'], {
    tags: ['runs', 'targets', 'routes'],
})

/** fetches a route by id with its metadata. */
async function _findRouteById(routeId: string) {
    const route = await prisma.route.findUnique({
        where: { id: routeId },
    })
    if (!route) throw new Error('route not found.')
    return route
}
export const findRouteById = cache(_findRouteById, ['route-by-id'], {
    tags: ['routes'],
})

/** fetches the rank of the first predicted route that matches an acceptable route. */
async function _findFirstAcceptableMatchRank(targetId: string, runId: string, stockId: string) {
    const result = await prisma.predictionRoute.findFirst({
        where: {
            targetId,
            predictionRunId: runId,
            solvabilityStatus: {
                some: {
                    matchesAcceptable: true,
                    stockId: stockId,
                },
            },
        },
        select: { rank: true },
        orderBy: { rank: 'asc' },
    })
    return result?.rank
}
export const findFirstAcceptableMatchRank = cache(_findFirstAcceptableMatchRank, ['first-acceptable-match-rank'], {
    tags: ['routes', 'targets', 'runs', 'stocks'],
})

/** fetches a lightweight list of prediction summaries (rank, routeId) for a target in a run. */
async function _findPredictionSummaries(targetId: string, runId: string) {
    return prisma.predictionRoute.findMany({
        where: { targetId, predictionRunId: runId },
        select: {
            rank: true,
            routeId: true,
        },
        orderBy: { rank: 'asc' },
    })
}
export const findPredictionSummaries = cache(_findPredictionSummaries, ['prediction-summaries-for-target'], {
    tags: ['routes', 'targets', 'runs'],
})

/** fetches a single predicted route by rank, with its solvability status. */
async function _findSinglePredictionForTarget(targetId: string, runId: string, rank: number, stockId?: string) {
    return prisma.predictionRoute.findUnique({
        where: {
            predictionRunId_targetId_rank: {
                predictionRunId: runId,
                targetId: targetId,
                rank: rank,
            },
        },
        include: {
            route: true, // we need the route metadata
            solvabilityStatus: {
                where: stockId ? { stockId } : undefined,
                include: { stock: { select: { name: true } } },
            },
        },
    })
}
export const findSinglePredictionForTarget = cache(_findSinglePredictionForTarget, ['single-prediction-for-target'], {
    tags: ['routes', 'targets', 'runs', 'stocks'],
})
