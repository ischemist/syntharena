/**
 * data access layer for prediction models.
 */
import { unstable_cache as cache } from 'next/cache'
import { Prisma } from '@prisma/client'

import prisma from '@/lib/db'
import { compareVersions } from '@/lib/utils'

/**
 * fetches prediction run info for a target. now supports `viewMode`.
 * in curated mode (`devMode: false`), it returns only the "champion" (latest version) for each model family.
 * in developer mode (`devMode: true`), it returns ALL runs for the target.
 */
async function _findPredictionRunsForTarget(targetId: string, devMode: boolean = false) {
    const runsWithPredictions = await prisma.predictionRun.findMany({
        where: { predictionCandidates: { some: { targetId, routeId: { not: null } } } },
        select: {
            id: true,
            executedAt: true,
            modelInstance: {
                select: {
                    id: true,
                    versionMajor: true,
                    versionMinor: true,
                    versionPatch: true,
                    versionPrerelease: true,
                    family: {
                        select: {
                            id: true,
                            name: true,
                            algorithm: { select: { name: true } },
                        },
                    },
                },
            },
            _count: {
                select: { predictionCandidates: { where: { targetId, routeId: { not: null } } } },
            },
        },
        orderBy: { executedAt: 'desc' },
    })

    // if in developer mode, we are done. return everything.
    if (devMode) {
        return runsWithPredictions
    }

    // else, apply the "champion instance" curation logic.
    const championsByFamily = new Map<string, (typeof runsWithPredictions)[0]>()
    for (const run of runsWithPredictions) {
        const familyId = run.modelInstance.family.id
        const currentChampion = championsByFamily.get(familyId)

        if (!currentChampion || compareVersions(currentChampion.modelInstance, run.modelInstance) < 0) {
            championsByFamily.set(familyId, run)
        }
    }
    return Array.from(championsByFamily.values())
}
export const findPredictionRunsForTarget = cache(_findPredictionRunsForTarget, ['runs-for-target'], {
    tags: ['runs', 'targets', 'routes'],
})

/** fetches the raw nodes for a predicted route. does not build the tree. */
async function _findPredictedRouteNodes(targetId: string, runId: string, rank: number) {
    const prediction = await prisma.predictionCandidate.findFirst({
        where: { targetId, predictionRunId: runId, rank, routeId: { not: null } },
        select: {
            route: {
                select: {
                    nodes: { include: { molecule: true, reactionStep: true } },
                },
            },
        },
    })
    return prediction?.route?.nodes ?? null
}
export const findPredictedRouteNodes = cache(_findPredictedRouteNodes, ['predicted-route-nodes'], {
    tags: ['routes', 'targets', 'runs'],
})

/**
 * finds benchmark targets for a run and counts the number of predicted routes for each.
 * optimized for the target search component on the run detail page.
 */
async function _findTargetsAndPredictionCountsForRun(
    runId: string,
    where: Prisma.BenchmarkTargetWhereInput,
    limit: number,
    onlyWithPredictions?: boolean
) {
    // first, get the benchmarkId from the run
    const run = await prisma.predictionRun.findUnique({
        where: { id: runId },
        select: { benchmarkSetId: true },
    })
    if (!run) throw new Error('run not found.')

    // build the where clause with optional prediction filter
    const targetWhere: Prisma.BenchmarkTargetWhereInput = {
        ...where,
        benchmarkSetId: run.benchmarkSetId,
        ...(onlyWithPredictions && {
            predictionCandidates: { some: { predictionRunId: runId, routeId: { not: null } } },
        }),
    }

    // find the paginated targets for that benchmark matching the where clause
    const targets = await prisma.benchmarkTarget.findMany({
        where: targetWhere,
        include: { molecule: true },
        orderBy: { targetId: 'asc' },
        take: limit,
    })

    // now, efficiently count the predictions for ONLY these targets in this specific run
    const targetIds = targets.map((t) => t.id)
    const counts =
        targetIds.length > 0
            ? await prisma.predictionCandidate.groupBy({
                  by: ['targetId'],
                  where: {
                      predictionRunId: runId,
                      routeId: { not: null },
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

/**
 * fetches ordered target IDs for a run that have at least one prediction.
 * used for navigation when filtering to only targets with predictions.
 */
async function _findTargetIdsWithPredictionsForRun(runId: string, routeLength?: number) {
    // get all unique target IDs that have predictions in this run
    const predictions = await prisma.predictionCandidate.findMany({
        where: { predictionRunId: runId, routeId: { not: null } },
        select: {
            target: {
                select: {
                    id: true,
                    targetId: true,
                    routeLength: true,
                },
            },
        },
        distinct: ['targetId'],
    })

    // filter by route length if specified and collect IDs
    const targetIds = predictions.flatMap((prediction) =>
        routeLength === undefined || prediction.target.routeLength === routeLength ? [prediction.target.id] : []
    )

    // fetch full targets to maintain proper ordering by targetId
    const orderedTargets = await prisma.benchmarkTarget.findMany({
        where: { id: { in: targetIds } },
        select: { id: true },
        orderBy: { targetId: 'asc' },
    })

    return orderedTargets.map((t) => t.id)
}
export const findTargetIdsWithPredictionsForRun = cache(
    _findTargetIdsWithPredictionsForRun,
    ['target-ids-with-predictions-for-run'],
    { tags: ['targets', 'runs'] }
)
