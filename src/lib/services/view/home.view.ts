/**
 * view model composition layer for the home page.
 * aggregates data from multiple domains for the main dashboard.
 */
import type { HomePageStats, BenchmarkOverview } from '@/types'

import * as benchmarkData from '../data/benchmark.data'
import * as metaData from '../data/meta.data'
import * as runData from '../data/run.data'

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
    // this data function already gets most of what we need. we just need run counts.
    // instead of a new data function, let's just get the benchmarks and compose here.
    const runCounts = await Promise.all(
        benchmarks.map((b) =>
            runData.findPredictionRunsForBenchmark(b.id).then((runs) => ({ id: b.id, count: runs.length }))
        )
    )
    const runCountMap = new Map(runCounts.map((rc) => [rc.id, rc.count]))

    return benchmarks.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        targetCount: b._count.targets,
        stockName: b.stock.name,
        hasAcceptableRoutes: b.hasAcceptableRoutes,
        runCount: runCountMap.get(b.id) || 0,
    }))
}
