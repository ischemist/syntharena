/**
 * view model composition layer for benchmarks.
 * rule: this file is FORBIDDEN from importing `prisma`.
 * it consumes functions from the `data` layer and composes them into
 * DTOs needed by server components.
 */
import { Prisma } from '@prisma/client'

import type { BenchmarkListItem, BenchmarkTargetSearchResult, BenchmarkTargetWithMolecule } from '@/types'

import * as data from '../data/benchmark.data.ts'

/** prepares the DTO for the main benchmark list page. */
export async function getBenchmarkSets(): Promise<BenchmarkListItem[]> {
    const rawBenchmarks = await data.findBenchmarkListItems()
    return rawBenchmarks.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description || undefined,
        stockId: b.stockId,
        stock: b.stock,
        hasAcceptableRoutes: b.hasAcceptableRoutes,
        createdAt: b.createdAt,
        targetCount: b._count.targets,
    }))
}

/** prepares the DTO for a single benchmark header/detail view. */
export async function getBenchmarkById(benchmarkId: string): Promise<BenchmarkListItem> {
    const b = await data.findBenchmarkListItemById(benchmarkId)
    return {
        id: b.id,
        name: b.name,
        description: b.description || undefined,
        stockId: b.stockId,
        stock: b.stock,
        hasAcceptableRoutes: b.hasAcceptableRoutes,
        createdAt: b.createdAt,
        targetCount: b._count.targets,
    }
}

/** builds the complex search result object for the benchmark targets page. */
export async function getBenchmarkTargets(
    benchmarkId: string,
    page: number = 1,
    limit: number = 24,
    searchQuery?: string,
    searchType: 'smiles' | 'inchikey' | 'targetId' | 'all' = 'all',
    hasGroundTruth?: boolean,
    minRouteLength?: number,
    maxRouteLength?: number,
    isConvergent?: boolean
): Promise<BenchmarkTargetSearchResult> {
    const where: Prisma.BenchmarkTargetWhereInput = { benchmarkSetId: benchmarkId }

    // build where clause
    if (searchQuery?.trim()) {
        const query = searchQuery.trim()
        const conditions: Prisma.BenchmarkTargetWhereInput[] = []
        if (searchType === 'smiles' || searchType === 'all')
            conditions.push({ molecule: { smiles: { contains: query } } })
        if (searchType === 'inchikey' || searchType === 'all')
            conditions.push({ molecule: { inchikey: { contains: query } } })
        if (searchType === 'targetId' || searchType === 'all') conditions.push({ targetId: { contains: query } })
        if (conditions.length > 0) where.OR = conditions
    }

    if (hasGroundTruth !== undefined) where.acceptableRoutes = hasGroundTruth ? { some: {} } : { none: {} }

    if (minRouteLength !== undefined || maxRouteLength !== undefined) {
        where.routeLength = {
            ...(minRouteLength !== undefined && { gte: minRouteLength }),
            ...(maxRouteLength !== undefined && { lte: maxRouteLength }),
        }
    }

    if (isConvergent !== undefined) where.isConvergent = isConvergent

    const validLimit = Math.min(Math.max(1, limit), 100)
    const offset = (page - 1) * validLimit

    // call the data layer
    const { targets, total, countMap } = await data.findBenchmarkTargetsPaginated(
        benchmarkId,
        where,
        validLimit,
        offset
    )

    const hasMore = targets.length > validLimit
    const resultTargets = hasMore ? targets.slice(0, validLimit) : targets

    // transform raw data into the final DTO
    const targetsWithCounts: BenchmarkTargetWithMolecule[] = resultTargets.map((target) => {
        const acceptableRoutesCount = countMap.get(target.id) || 0
        return {
            ...target,
            hasAcceptableRoutes: acceptableRoutesCount > 0,
            acceptableRoutesCount,
        }
    })

    return { targets: targetsWithCounts, total, hasMore, page, limit: validLimit }
}

/** prepares the DTO for a single target detail view. */
export async function getTargetById(targetId: string): Promise<BenchmarkTargetWithMolecule> {
    const target = await data.findTargetWithDetailsById(targetId)
    return {
        ...target,
        hasAcceptableRoutes: target.acceptableRoutesCount > 0,
    }
}
