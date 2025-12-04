import prisma from '@/lib/db'

/**
 * Statistics for the home page overview
 */
export interface HomePageStats {
    totalAlgorithms: number
    totalModelInstances: number
    totalPredictionRuns: number
    totalUniqueRoutes: number
    totalBenchmarks: number
    stockStats: Array<{
        name: string
        moleculeCount: number
    }>
}

/**
 * Overview of a benchmark set for home page display
 */
export interface BenchmarkOverview {
    id: string
    name: string
    description: string | null
    targetCount: number
    stockName: string
    hasAcceptableRoutes: boolean
    runCount: number
}

/**
 * Aggregate statistics for the home page
 */
export async function getHomePageStats(): Promise<HomePageStats> {
    const [totalAlgorithms, totalModelInstances, totalPredictionRuns, totalUniqueRoutes, totalBenchmarks, stockStats] =
        await Promise.all([
            prisma.algorithm.count(),
            prisma.modelInstance.count(),
            prisma.predictionRun.count(),
            prisma.route.count(),
            prisma.benchmarkSet.count(),
            prisma.stock.findMany({
                select: {
                    name: true,
                    _count: {
                        select: {
                            items: true,
                        },
                    },
                },
            }),
        ])

    return {
        totalAlgorithms,
        totalModelInstances,
        totalPredictionRuns,
        totalUniqueRoutes,
        totalBenchmarks,
        stockStats: stockStats.map((stock) => ({
            name: stock.name,
            moleculeCount: stock._count.items,
        })),
    }
}

/**
 * Get overview of all benchmark sets with aggregated data
 */
export async function getBenchmarkOverview(): Promise<BenchmarkOverview[]> {
    const benchmarks = await prisma.benchmarkSet.findMany({
        select: {
            id: true,
            name: true,
            description: true,
            hasAcceptableRoutes: true,
            stock: {
                select: {
                    name: true,
                },
            },
            _count: {
                select: {
                    targets: true,
                    runs: true,
                },
            },
        },
        orderBy: {
            name: 'asc',
        },
    })

    return benchmarks.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        targetCount: b._count.targets,
        stockName: b.stock.name,
        hasAcceptableRoutes: b.hasAcceptableRoutes,
        runCount: b._count.runs,
    }))
}

/**
 * Get featured or recent prediction runs for highlights
 */
export async function getFeaturedRuns(limit = 5) {
    const runs = await prisma.predictionRun.findMany({
        take: limit,
        orderBy: {
            executedAt: 'desc',
        },
        select: {
            id: true,
            executedAt: true,
            totalRoutes: true,
            modelInstance: {
                select: {
                    name: true,
                    algorithm: {
                        select: {
                            name: true,
                        },
                    },
                },
            },
            benchmarkSet: {
                select: {
                    name: true,
                },
            },
        },
    })

    return runs.map((run) => ({
        id: run.id,
        modelName: run.modelInstance.name,
        algorithmName: run.modelInstance.algorithm.name,
        benchmarkName: run.benchmarkSet.name,
        totalRoutes: run.totalRoutes,
        executedAt: run.executedAt,
    }))
}
