/**
 * view model composition layer for the home page.
 * aggregates data from multiple domains for the main dashboard.
 */
import prisma from '@/lib/db' // ok to use here for simple counts not worth a data function

import type { HomePageStats, BenchmarkOverview } from '@/types'

export async function getHomePageStats(): Promise<HomePageStats> {
    const [algorithms, models, runs, routes, benchmarks, stocks] = await Promise.all([
        prisma.algorithm.count(),
        prisma.modelInstance.count(),
        prisma.predictionRun.count(),
        prisma.route.count(),
        prisma.benchmarkSet.count(),
        prisma.stock.findMany({ select: { name: true, _count: { select: { items: true } } } }),
    ])

    return {
        totalAlgorithms: algorithms,
        totalModelInstances: models,
        totalPredictionRuns: runs,
        totalUniqueRoutes: routes,
        totalBenchmarks: benchmarks,
        stockStats: stocks.map((s) => ({ name: s.name, moleculeCount: s._count.items })),
    }
}

export async function getBenchmarkOverview(): Promise<BenchmarkOverview[]> {
    const benchmarks = await prisma.benchmarkSet.findMany({
        select: {
            id: true,
            name: true,
            description: true,
            hasAcceptableRoutes: true,
            stock: { select: { name: true } },
            _count: { select: { targets: true, runs: true } },
        },
        orderBy: { name: 'asc' },
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
