/**
 * Integration tests for getLeaderboardPageData in leaderboard.view.ts
 *
 * Tests the full orchestration path: database setup -> view model construction.
 * Uses a real SQLite test database (no mocks), except for next/cache which
 * requires a Next.js runtime context unavailable in Vitest.
 *
 * The pure transformation helpers (_curateChampionStats, _transformStatsToLeaderboardDTOs)
 * are tested separately in leaderboard.view.test.ts; here we focus on the public
 * entry point and its composition behaviour.
 */

// next/cache's unstable_cache requires a Next.js incremental cache that is not available
// in the Vitest node environment. Mock it as a simple pass-through so the data-layer
// functions run directly against the test database without caching.
import { describe, expect, it, vi } from 'vitest'

import prisma from '@/lib/db'
import { loadBenchmarkFromFile } from '@/lib/services/loaders/benchmark-loader.service'
import {
    createModelStatistics,
    createOrUpdatePredictionRun,
    createRouteFromPython,
    createRouteSolvability,
} from '@/lib/services/loaders/prediction-loader.service'
import { loadStockFromFile } from '@/lib/services/loaders/stock-loader.service'
import { getLeaderboardPageData } from '@/lib/services/view/leaderboard.view'

import {
    carbonChainSmiles,
    cleanupTempFiles,
    createFullModelChain,
    createTestBenchmarkGzFile,
    createTestCsvFile,
    makeLinearPythonRoute,
    makeModelStatistics,
    syntheticInchiKey,
} from '../../../helpers/factories'

vi.mock('next/cache', () => ({
    unstable_cache: <T extends (...args: unknown[]) => Promise<unknown>>(fn: T) => fn,
    revalidateTag: vi.fn(),
    revalidatePath: vi.fn(),
}))

// ============================================================================
// Helper: build a minimal full pipeline context
// ============================================================================

/**
 * Sets up: stock -> benchmark (with isListed=true) -> model chain -> prediction run -> stats.
 * Returns IDs needed for assertions.
 */
async function setupLeaderboardContext(label: string) {
    // Stock
    const stockMolecules = [
        { smiles: carbonChainSmiles(1), inchikey: syntheticInchiKey(`${label}-C`) },
        { smiles: carbonChainSmiles(2), inchikey: syntheticInchiKey(`${label}-CC`) },
        { smiles: carbonChainSmiles(3), inchikey: syntheticInchiKey(`${label}-CCC`) },
    ]
    const csvPath = createTestCsvFile(stockMolecules)
    const stockResult = await loadStockFromFile(csvPath, `${label}-stock`)

    // Benchmark — must be listed (isListed: true) for findBenchmarkListItems to include it
    const benchmark = await prisma.benchmarkSet.create({
        data: {
            name: `${label}-benchmark`,
            stockId: stockResult.stockId,
            isListed: true,
        },
    })

    // Load a simple benchmark target
    const route = makeLinearPythonRoute(2)
    const targetSmiles = route.target.smiles
    const benchData = {
        name: `${label}-benchmark`,
        targets: {
            [`${label}-t-001`]: {
                id: `${label}-t-001`,
                smiles: targetSmiles,
                inchi_key: syntheticInchiKey(targetSmiles),
                acceptable_routes: [
                    {
                        target: route.target,
                        rank: 1,
                        signature: route.signature,
                        length: 2,
                        has_convergent_reaction: false,
                    },
                ],
            },
        },
    }
    const gzPath = createTestBenchmarkGzFile(benchData)
    await loadBenchmarkFromFile(gzPath, benchmark.id, `${label}-benchmark`)

    // Model chain + run
    const { instance, family } = await createFullModelChain({ algorithmName: `${label}-algo` })
    const run = await createOrUpdatePredictionRun(benchmark.id, instance.id, { hourlyCost: 1.0 })

    // Load prediction route (same as acceptable)
    const target = await prisma.benchmarkTarget.findFirst({ where: { benchmarkSetId: benchmark.id } })
    const pred = await createRouteFromPython(route, run.id, target!.id)

    // Solvability
    await createRouteSolvability(pred.predictionRouteId, stockResult.stockId, true, true, 0, 2, false, 10.0, 20.0)

    // Statistics with Solvability + Top-1 + Top-10
    const stats = makeModelStatistics({
        totalWallTime: 3600,
        solvability: {
            metricName: 'Solvability',
            overall: {
                value: 0.8,
                ciLower: 0.7,
                ciUpper: 0.9,
                nSamples: 100,
                reliability: { code: 'OK', message: 'OK' },
            },
            byGroup: {},
        },
        topKAccuracy: {
            '1': {
                metricName: 'Top-1',
                overall: {
                    value: 0.4,
                    ciLower: 0.3,
                    ciUpper: 0.5,
                    nSamples: 100,
                    reliability: { code: 'OK', message: 'OK' },
                },
                byGroup: {},
            },
            '10': {
                metricName: 'Top-10',
                overall: {
                    value: 0.7,
                    ciLower: 0.6,
                    ciUpper: 0.8,
                    nSamples: 100,
                    reliability: { code: 'OK', message: 'OK' },
                },
                byGroup: {},
            },
        },
    })
    await createModelStatistics(run.id, benchmark.id, stockResult.stockId, stats)

    return { benchmark, run, instance, family, stockResult }
}

// ============================================================================
// getLeaderboardPageData
// ============================================================================

describe('getLeaderboardPageData', () => {
    it('returns null when no listed benchmarks exist', async () => {
        const result = await getLeaderboardPageData()
        expect(result).toBeNull()
    })

    it('returns full leaderboard data for a benchmark with stats', async () => {
        const { benchmark, stockResult } = await setupLeaderboardContext('basic')
        cleanupTempFiles()

        const result = await getLeaderboardPageData(benchmark.id)

        expect(result).not.toBeNull()
        expect(result!.selectedBenchmark.id).toBe(benchmark.id)
        expect(result!.allBenchmarks).toHaveLength(1)
        expect(result!.allBenchmarks[0].id).toBe(benchmark.id)

        // Should have one leaderboard entry
        expect(result!.leaderboardEntries).toHaveLength(1)
        const entry = result!.leaderboardEntries[0]
        expect(entry.metrics.solvability.value).toBe(0.8)
        expect(entry.hasAcceptableRoutes).toBe(true)

        // Top-K metrics should be present (benchmark has acceptable routes)
        expect(entry.metrics.topKAccuracy).toBeDefined()
        expect(entry.metrics.topKAccuracy!['Top-1'].value).toBe(0.4)
        expect(entry.metrics.topKAccuracy!['Top-10'].value).toBe(0.7)

        // Available top-k metrics should be populated and sorted
        expect(result!.metadata.hasAcceptableRoutes).toBe(true)
        expect(result!.metadata.availableTopKMetrics).toEqual(['Top-1', 'Top-10'])

        // Stocks list should contain our stock
        expect(result!.stocks).toHaveLength(1)
        expect(result!.stocks[0].id).toBe(stockResult.stockId)
    })

    it('returns empty leaderboard entries (not null) when benchmark has no statistics', async () => {
        // Create a listed benchmark with no prediction runs
        const stock = await prisma.stock.create({ data: { name: 'empty-bench-stock' } })
        await prisma.benchmarkSet.create({
            data: { name: 'empty-benchmark', stockId: stock.id, isListed: true },
        })

        const result = await getLeaderboardPageData()

        expect(result).not.toBeNull()
        expect(result!.leaderboardEntries).toHaveLength(0)
        expect(result!.stocks).toHaveLength(0)
        expect(result!.metadata.availableTopKMetrics).toHaveLength(0)
    })

    it('falls back to first benchmark when given an invalid benchmarkId', async () => {
        const { benchmark } = await setupLeaderboardContext('fallback')
        cleanupTempFiles()

        const result = await getLeaderboardPageData('nonexistent-benchmark-id')

        // Should fall back to the first (and only) listed benchmark
        expect(result).not.toBeNull()
        expect(result!.selectedBenchmark.id).toBe(benchmark.id)
    })

    it('devMode skips champion curation — returns all instances not just best per family', async () => {
        const { benchmark, instance: instance1, family } = await setupLeaderboardContext('devmode')
        cleanupTempFiles()

        // Add a second model instance in the SAME family
        const instance2 = await prisma.modelInstance.create({
            data: {
                modelFamilyId: family.id,
                slug: `devmode-model-v2-${Date.now()}`,
                versionMajor: 2,
                versionMinor: 0,
                versionPatch: 0,
            },
        })
        const run2 = await createOrUpdatePredictionRun(benchmark.id, instance2.id)

        // Give the second instance its own route + stats (lower solvability)
        const route2 = makeLinearPythonRoute(1)
        const target = await prisma.benchmarkTarget.findFirst({ where: { benchmarkSetId: benchmark.id } })
        const pred2 = await createRouteFromPython(route2, run2.id, target!.id)
        const stockId = (await prisma.modelRunStatistics.findFirst({
            where: {
                predictionRunId: (await prisma.predictionRun.findFirst({
                    where: { benchmarkSetId: benchmark.id, modelInstanceId: instance1.id },
                }))!.id,
            },
        }))!.stockId
        await createRouteSolvability(pred2.predictionRouteId, stockId, false, false, null, 1, false, 5.0, 10.0)
        const stats2 = makeModelStatistics({
            solvability: {
                metricName: 'Solvability',
                overall: {
                    value: 0.3,
                    ciLower: 0.2,
                    ciUpper: 0.4,
                    nSamples: 50,
                    reliability: { code: 'OK', message: 'OK' },
                },
                byGroup: {},
            },
        })
        await createModelStatistics(run2.id, benchmark.id, stockId, stats2)

        // Without devMode: only 1 entry (champion — the one with highest Top-10)
        const normalResult = await getLeaderboardPageData(benchmark.id, false)
        expect(normalResult!.leaderboardEntries).toHaveLength(1)

        // With devMode: both instances appear
        const devResult = await getLeaderboardPageData(benchmark.id, true)
        expect(devResult!.leaderboardEntries).toHaveLength(2)
    })

    it('stratifiedMetricsByStock is populated correctly', async () => {
        const { benchmark, stockResult } = await setupLeaderboardContext('strat')
        cleanupTempFiles()

        const result = await getLeaderboardPageData(benchmark.id)

        expect(result).not.toBeNull()
        const byStock = result!.stratifiedMetricsByStock
        expect(byStock.has(stockResult.stockId)).toBe(true)

        const modelMap = byStock.get(stockResult.stockId)!
        expect(modelMap.size).toBe(1) // one model family

        const [, metrics] = Array.from(modelMap.entries())[0]
        expect(metrics.solvability.overall.value).toBe(0.8)
        expect(metrics.topKAccuracy).toBeDefined()
        expect(metrics.topKAccuracy!['Top-1'].overall.value).toBe(0.4)
    })
})
