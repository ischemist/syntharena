/**
 * data access layer for prediction models.
 */
import { unstable_cache as cache } from 'next/cache'
import { Prisma } from '@prisma/client'

import prisma from '@/lib/db'
import { compareVersions } from '@/lib/utils'

/**
 * fetches prediction run info for a target. now supports `viewMode`.
 * in 'curated' mode, it returns only the "champion" (latest version) for each model family.
 * in 'forensic' mode, it returns ALL runs for the target.
 */
async function _findPredictionRunsForTarget(targetId: string, viewMode: 'curated' | 'forensic' = 'curated') {
    const runsWithPredictions = await prisma.predictionRun.findMany({
        where: { predictionRoutes: { some: { targetId: targetId } } },
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
                select: { predictionRoutes: { where: { targetId } } },
            },
        },
        orderBy: { executedAt: 'desc' },
    })

    // if in forensic mode, we are done. return everything.
    if (viewMode === 'forensic') {
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
