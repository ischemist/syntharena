/**
 * data access layer for benchmark & target models.
 * rule: this file is the ONLY place that should import `prisma` for these models.
 * functions here should be lean, efficient, and return raw prisma-like objects.
 * caching is applied at this layer.
 */

import { unstable_cache as cache } from 'react'
import { Prisma } from '@prisma/client'

import type { BenchmarkSet, BenchmarkStats } from '@/types'
import prisma from '@/lib/db'

// ============================================================================
// mutations
// ============================================================================

export async function createBenchmark(
    name: string,
    description: string | undefined,
    stockId: string
): Promise<BenchmarkSet> {
    try {
        return await prisma.benchmarkSet.create({
            data: { name, description, stockId },
            include: { stock: true },
        })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') throw new Error(`benchmark name "${name}" already exists.`)
            if (error.code === 'P2003') throw new Error(`stock with id "${stockId}" not found.`)
        }
        throw error
    }
}

export async function deleteBenchmarkAndDeps(benchmarkId: string): Promise<void> {
    const exists = await prisma.benchmarkSet.findUnique({
        where: { id: benchmarkId },
        select: { id: true },
    })
    if (!exists) throw new Error('benchmark not found.')

    // note: cascades will handle related PredictionRoute and RouteSolvability
    await prisma.$transaction([
        prisma.predictionRun.deleteMany({ where: { benchmarkSetId: benchmarkId } }),
        prisma.acceptableRoute.deleteMany({ where: { target: { benchmarkSetId: benchmarkId } } }),
        prisma.benchmarkTarget.deleteMany({ where: { benchmarkSetId: benchmarkId } }),
        prisma.benchmarkSet.delete({ where: { id: benchmarkId } }),
    ])
}

// ============================================================================
// reads (raw data)
// ============================================================================

/** returns data needed to build a `BenchmarkListItem` */
async function _findBenchmarkListItems() {
    return prisma.benchmarkSet.findMany({
        select: {
            id: true,
            name: true,
            description: true,
            stockId: true,
            hasAcceptableRoutes: true,
            createdAt: true,
            stock: { select: { id: true, name: true, description: true } },
            _count: { select: { targets: true } },
        },
        orderBy: { createdAt: 'desc' },
    })
}
export const findBenchmarkListItems = cache(_findBenchmarkListItems, ['benchmark-list'], {
    tags: ['benchmarks'],
})
export type BenchmarkListItemPayload = Prisma.PromiseReturnType<typeof _findBenchmarkListItems>[0]

/** returns data needed to build a `BenchmarkListItem` for a single benchmark */
async function _findBenchmarkListItemById(benchmarkId: string) {
    const benchmark = await prisma.benchmarkSet.findUnique({
        where: { id: benchmarkId },
        select: {
            id: true,
            name: true,
            description: true,
            stockId: true,
            hasAcceptableRoutes: true,
            createdAt: true,
            stock: { select: { id: true, name: true, description: true } },
            _count: { select: { targets: true } },
        },
    })
    if (!benchmark) throw new Error('benchmark not found.')
    return benchmark
}
export const findBenchmarkListItemById = cache(_findBenchmarkListItemById, ['benchmark-list-item-by-id'], {
    tags: ['benchmarks'],
})

/** returns raw data for the paginated target list view */
async function _findBenchmarkTargetsPaginated(
    benchmarkId: string,
    where: Prisma.BenchmarkTargetWhereInput,
    limit: number,
    offset: number
) {
    const [targets, total] = await Promise.all([
        prisma.benchmarkTarget.findMany({
            where,
            include: { molecule: true },
            orderBy: { targetId: 'asc' },
            take: limit + 1, // fetch one extra to check for `hasMore`
            skip: offset,
        }),
        prisma.benchmarkTarget.count({ where }),
    ])

    const targetIds = targets.map((t) => t.id)
    const counts =
        targetIds.length > 0
            ? await prisma.acceptableRoute.groupBy({
                  by: ['benchmarkTargetId'],
                  where: { benchmarkTargetId: { in: targetIds } },
                  _count: { _all: true },
              })
            : []

    const countMap = new Map(counts.map((c) => [c.benchmarkTargetId, c._count._all]))

    return { targets, total, countMap }
}
export const findBenchmarkTargetsPaginated = cache(_findBenchmarkTargetsPaginated, ['benchmark-targets-paginated'], {
    tags: ['benchmarks', 'targets'],
})

/** returns data for a single target detail view */
async function _findTargetWithDetailsById(targetId: string) {
    const target = await prisma.benchmarkTarget.findUnique({
        where: { id: targetId },
        include: { molecule: true },
    })

    if (!target) throw new Error('benchmark target not found.')

    const acceptableRoutesCount = await prisma.acceptableRoute.count({
        where: { benchmarkTargetId: target.id },
    })

    return { ...target, acceptableRoutesCount }
}
export const findTargetWithDetailsById = cache(_findTargetWithDetailsById, ['target-details-by-id'], {
    tags: ['targets'],
})
export type TargetWithDetailsPayload = Prisma.PromiseReturnType<typeof _findTargetWithDetailsById>

/** computes aggregate stats for a benchmark set */
export async function _computeBenchmarkStats(benchmarkId: string): Promise<BenchmarkStats> {
    const [targets, targetsWithAcceptableRoutes] = await Promise.all([
        prisma.benchmarkTarget.findMany({
            where: { benchmarkSetId: benchmarkId },
            select: { routeLength: true, isConvergent: true },
        }),
        prisma.benchmarkTarget.count({
            where: { benchmarkSetId: benchmarkId, acceptableRoutes: { some: {} } },
        }),
    ])

    const routeLengths = targets.map((t) => t.routeLength).filter((l): l is number => l !== null)
    const totalLength = routeLengths.reduce((a, b) => a + b, 0)

    return {
        totalTargets: targets.length,
        targetsWithAcceptableRoutes,
        avgRouteLength: routeLengths.length > 0 ? totalLength / routeLengths.length : 0,
        convergentRoutes: targets.filter((t) => t.isConvergent).length,
        minRouteLength: routeLengths.length > 0 ? Math.min(...routeLengths) : 0,
        maxRouteLength: routeLengths.length > 0 ? Math.max(...routeLengths) : 0,
    }
}
export const computeBenchmarkStats = cache(_computeBenchmarkStats, ['benchmark-stats'], {
    tags: ['benchmarks', 'targets'],
})
