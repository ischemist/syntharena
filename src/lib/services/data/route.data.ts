/**
 * data access layer for route models.
 * handles `Route`, `RouteNode`, `PredictionCandidate`, and `AcceptableRoute`.
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
        include: { molecule: true, reactionStep: true },
    })
}
export const findNodesForRoute = cache(_findNodesForRoute, ['nodes-for-route'], {
    tags: ['routes'],
})
export type RouteNodeWithMoleculePayload = Prisma.PromiseReturnType<typeof _findNodesForRoute>

/** fetches a specific predicted route with its full relational hierarchy. */
async function _findPredictedRouteForTarget(targetId: string, runId: string, rank: number) {
    return prisma.predictionCandidate.findFirst({
        where: { targetId, predictionRunId: runId, rank, routeId: { not: null } },
        include: {
            route: {
                include: {
                    nodes: { include: { molecule: true, reactionStep: true } },
                },
            },
        },
    })
}

/** fetches all acceptable routes for a given target. */
async function _findAcceptableRoutesForTarget(targetId: string) {
    return prisma.acceptableRoute.findMany({
        where: { benchmarkTargetId: targetId },
        select: {
            routeIndex: true,
            route: {
                select: { id: true, signature: true },
            },
        },
        orderBy: { routeIndex: 'asc' },
    })
}
export const findAcceptableRoutesForTarget = cache(_findAcceptableRoutesForTarget, ['acceptable-routes-for-target'], {
    tags: ['routes', 'targets'],
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
async function _findFirstAcceptableMatchRank(targetId: string, runId: string, evaluationId: string) {
    const result = await prisma.predictionCandidate.findFirst({
        where: {
            targetId,
            predictionRunId: runId,
            evaluations: {
                some: {
                    matchesAcceptable: true,
                    runEvaluationId: evaluationId,
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
    return prisma.predictionCandidate.findMany({
        where: {
            targetId,
            predictionRunId: runId,
        },
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

/** fetches a single predicted route by rank with independent tier and constraint status. */
async function _findSinglePredictionForTarget(targetId: string, runId: string, rank: number, evaluationId?: string) {
    return prisma.predictionCandidate.findFirst({
        where: {
            predictionRunId: runId,
            targetId: targetId,
            rank: rank,
        },
        include: {
            route: true, // we need the route metadata
            evaluations: {
                where: evaluationId ? { runEvaluationId: evaluationId } : undefined,
                include: {
                    tierResults: true,
                    runEvaluation: { include: { stock: { select: { id: true, name: true } } } },
                },
            },
        },
    })
}
export const findSinglePredictionForTarget = cache(_findSinglePredictionForTarget, ['single-prediction-for-target'], {
    tags: ['routes', 'targets', 'runs', 'stocks'],
})
