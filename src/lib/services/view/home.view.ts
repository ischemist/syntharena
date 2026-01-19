/**
 * view model composition layer for the home page.
 * aggregates data from multiple domains for the main dashboard.
 */
import type { BenchmarkOverview, HomePageStats } from '@/types'

import * as benchmarkData from '../data/benchmark.data'
import * as metaData from '../data/meta.data'

export async function getHomePageStats(): Promise<HomePageStats> {
    const [algorithms, models, runs, routes, benchmarks, stocks] = await Promise.all([
        metaData.countAlgorithms(),
        metaData.countModelInstances(),
        metaData.countPredictionRuns(),
        metaData.countRoutes(),
        metaData.countBenchmarks(),
        metaData.getStockStats(),
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
    const benchmarks = await benchmarkData.findBenchmarkListItems()

    return benchmarks.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        series: b.series,
        targetCount: b._count.targets,
        stockName: b.stock.name,
        hasAcceptableRoutes: b.hasAcceptableRoutes,
        runCount: b._count.runs,
    }))
}
