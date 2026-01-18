/**
 * data access layer for prediction models.
 */
import { unstable_cache as cache } from 'next/cache'

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

// helper for the above function
import type { RouteNodeWithDetails } from '@/types'
import type { RouteNodeWithMoleculePayload } from '@/lib/services/data/route.data'
function buildRouteTree(nodes: RouteNodeWithMoleculePayload): RouteNodeWithDetails {
    if (nodes.length === 0) throw new Error('cannot build tree from empty nodes.')
    const rootNodeData = nodes.find((n) => n.parentId === null)
    if (!rootNodeData) throw new Error('no root node found.')
    const nodeMap = new Map<string, RouteNodeWithDetails>()
    nodes.forEach((node) => {
        nodeMap.set(node.id, { ...node, children: [] })
    })
    nodes.forEach((node) => {
        if (node.parentId) {
            const parent = nodeMap.get(node.parentId)
            const child = nodeMap.get(node.id)
            if (parent && child) parent.children.push(child)
        }
    })
    const routeTree = nodeMap.get(rootNodeData.id)
    if (!routeTree) throw new Error('failed to build route tree.')
    return routeTree
}
