import { Prisma } from '@prisma/client'

import type {
    BenchmarkListItem,
    BenchmarkSet,
    BenchmarkStats,
    BenchmarkTargetSearchResult,
    BenchmarkTargetWithMolecule,
} from '@/types'
import prisma from '@/lib/db'

// ============================================================================
// Benchmark Management Functions (CRUD)
// ============================================================================

/**
 * Creates a new empty benchmark set.
 *
 * @param name - Unique benchmark name
 * @param description - Optional description
 * @param stockName - Optional reference stock name
 * @returns Created benchmark
 * @throws Error if name already exists
 */
export async function createBenchmark(name: string, description?: string, stockName?: string): Promise<BenchmarkSet> {
    try {
        return await prisma.benchmarkSet.create({
            data: {
                name,
                description: description || null,
                stockName: stockName || null,
            },
        })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new Error(`A benchmark with name "${name}" already exists.`)
        }
        throw error
    }
}

/**
 * Retrieves all benchmark sets with target counts.
 *
 * @returns Array of benchmarks with targetCount
 */
export async function getBenchmarkSets(): Promise<BenchmarkListItem[]> {
    const benchmarks = await prisma.benchmarkSet.findMany({
        include: {
            _count: {
                select: { targets: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    })

    return benchmarks.map((benchmark) => ({
        id: benchmark.id,
        name: benchmark.name,
        description: benchmark.description || undefined,
        stockName: benchmark.stockName || undefined,
        createdAt: benchmark.createdAt,
        targetCount: benchmark._count.targets,
    }))
}

/**
 * Retrieves a single benchmark by ID with target count.
 *
 * @param benchmarkId - The benchmark ID
 * @returns Benchmark with targetCount
 * @throws Error if benchmark not found
 */
export async function getBenchmarkById(benchmarkId: string): Promise<BenchmarkListItem> {
    const benchmark = await prisma.benchmarkSet.findUnique({
        where: { id: benchmarkId },
        include: {
            _count: {
                select: { targets: true },
            },
        },
    })

    if (!benchmark) {
        throw new Error('Benchmark not found')
    }

    return {
        id: benchmark.id,
        name: benchmark.name,
        description: benchmark.description || undefined,
        stockName: benchmark.stockName || undefined,
        createdAt: benchmark.createdAt,
        targetCount: benchmark._count.targets,
    }
}

/**
 * Deletes a benchmark and all its targets and routes.
 *
 * @param benchmarkId - The benchmark ID
 * @throws Error if benchmark not found
 */
export async function deleteBenchmark(benchmarkId: string): Promise<void> {
    const benchmark = await prisma.benchmarkSet.findUnique({
        where: { id: benchmarkId },
        select: { id: true },
    })

    if (!benchmark) {
        throw new Error('Benchmark not found')
    }

    // Delete in transaction (cascade relations)
    await prisma.$transaction([
        // Delete route nodes first (they reference routes)
        prisma.routeNode.deleteMany({
            where: {
                route: {
                    target: {
                        benchmarkSetId: benchmarkId,
                    },
                },
            },
        }),
        // Delete routes
        prisma.route.deleteMany({
            where: {
                target: {
                    benchmarkSetId: benchmarkId,
                },
            },
        }),
        // Delete benchmark targets
        prisma.benchmarkTarget.deleteMany({
            where: { benchmarkSetId: benchmarkId },
        }),
        // Delete benchmark
        prisma.benchmarkSet.delete({
            where: { id: benchmarkId },
        }),
    ])
}

// ============================================================================
// Target Query Functions
// ============================================================================

/**
 * Retrieves targets for a benchmark with pagination.
 *
 * @param benchmarkId - The benchmark ID
 * @param page - Page number (1-indexed)
 * @param limit - Number of results per page
 * @param hasGroundTruth - Filter by ground truth availability
 * @param minRouteLength - Filter by minimum route length
 * @param maxRouteLength - Filter by maximum route length
 * @param isConvergent - Filter by convergence
 * @returns Paginated targets with molecules
 * @throws Error if benchmark not found
 */
export async function getBenchmarkTargets(
    benchmarkId: string,
    page: number = 1,
    limit: number = 24,
    hasGroundTruth?: boolean,
    minRouteLength?: number,
    maxRouteLength?: number,
    isConvergent?: boolean
): Promise<BenchmarkTargetSearchResult> {
    // Verify benchmark exists
    const benchmark = await prisma.benchmarkSet.findUnique({
        where: { id: benchmarkId },
        select: { id: true },
    })

    if (!benchmark) {
        throw new Error('Benchmark not found')
    }

    const validPage = Math.max(1, page)
    const validLimit = Math.min(Math.max(1, limit), 100)
    const offset = (validPage - 1) * validLimit

    // Build where clause
    const where: Prisma.BenchmarkTargetWhereInput = {
        benchmarkSetId: benchmarkId,
    }

    if (hasGroundTruth !== undefined) {
        if (hasGroundTruth) {
            where.groundTruthRouteId = { not: null }
        } else {
            where.groundTruthRouteId = null
        }
    }

    if (minRouteLength !== undefined || maxRouteLength !== undefined) {
        const routeLengthFilter: Prisma.IntFilter = {}
        if (minRouteLength !== undefined) {
            routeLengthFilter.gte = minRouteLength
        }
        if (maxRouteLength !== undefined) {
            routeLengthFilter.lte = maxRouteLength
        }
        where.routeLength = routeLengthFilter
    }

    if (isConvergent !== undefined) {
        where.isConvergent = isConvergent
    }

    // Execute query
    const [targets, total] = await Promise.all([
        prisma.benchmarkTarget.findMany({
            where,
            include: {
                molecule: true,
            },
            orderBy: { targetId: 'asc' },
            take: validLimit + 1,
            skip: offset,
        }),
        prisma.benchmarkTarget.count({ where }),
    ])

    const hasMore = targets.length > validLimit
    const resultTargets = hasMore ? targets.slice(0, validLimit) : targets

    return {
        targets: resultTargets.map((target) => ({
            id: target.id,
            benchmarkSetId: target.benchmarkSetId,
            targetId: target.targetId,
            moleculeId: target.moleculeId,
            routeLength: target.routeLength,
            isConvergent: target.isConvergent,
            metadata: target.metadata,
            groundTruthRouteId: target.groundTruthRouteId,
            molecule: target.molecule,
            hasGroundTruth: !!target.groundTruthRouteId,
        })),
        total,
        hasMore,
        page: validPage,
        limit: validLimit,
    }
}

/**
 * Retrieves a single benchmark target with molecule and routes.
 *
 * @param targetId - The benchmark target ID
 * @returns Target with molecule and route info
 * @throws Error if target not found
 */
export async function getTargetById(targetId: string): Promise<BenchmarkTargetWithMolecule> {
    const target = await prisma.benchmarkTarget.findUnique({
        where: { id: targetId },
        include: {
            molecule: true,
        },
    })

    if (!target) {
        throw new Error('Benchmark target not found')
    }

    return {
        id: target.id,
        benchmarkSetId: target.benchmarkSetId,
        targetId: target.targetId,
        moleculeId: target.moleculeId,
        routeLength: target.routeLength,
        isConvergent: target.isConvergent,
        metadata: target.metadata,
        groundTruthRouteId: target.groundTruthRouteId,
        molecule: target.molecule,
        hasGroundTruth: !!target.groundTruthRouteId,
    }
}

// ============================================================================
// Statistics Functions
// ============================================================================

/**
 * Computes statistics for a benchmark set.
 *
 * @param benchmarkId - The benchmark ID
 * @returns Statistics object
 * @throws Error if benchmark not found
 */
export async function getBenchmarkStats(benchmarkId: string): Promise<BenchmarkStats> {
    const benchmark = await prisma.benchmarkSet.findUnique({
        where: { id: benchmarkId },
    })

    if (!benchmark) {
        throw new Error('Benchmark not found')
    }

    const targets = await prisma.benchmarkTarget.findMany({
        where: { benchmarkSetId: benchmarkId },
        select: {
            routeLength: true,
            isConvergent: true,
            groundTruthRouteId: true,
        },
    })

    const routeLengths = targets.filter((t) => t.routeLength !== null).map((t) => t.routeLength as number)

    return {
        totalTargets: targets.length,
        targetsWithGroundTruth: targets.filter((t) => t.groundTruthRouteId).length,
        avgRouteLength: routeLengths.length > 0 ? routeLengths.reduce((a, b) => a + b, 0) / routeLengths.length : 0,
        convergentRoutes: targets.filter((t) => t.isConvergent).length,
        minRouteLength: routeLengths.length > 0 ? Math.min(...routeLengths) : 0,
        maxRouteLength: routeLengths.length > 0 ? Math.max(...routeLengths) : 0,
    }
}
