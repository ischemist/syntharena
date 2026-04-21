/**
 * End-to-end roundtrip integration tests for the full loader pipeline.
 *
 * These tests chain all three loaders in sequence:
 *   1. Stock loader — load molecules from CSV
 *   2. Benchmark loader — load targets and acceptable routes from .json.gz
 *   3. Prediction loader — load prediction runs, routes, solvability, statistics
 *
 * Verifies that molecule deduplication, route deduplication, and all FK relationships
 * are maintained across the full pipeline.
 */

import { afterEach, describe, expect, it } from 'vitest'

import prisma from '@/lib/db'
import { loadBenchmarkFromFile } from '@/lib/services/loaders/benchmark-loader.service'
import {
    createModelStatistics,
    createMoleculeFromPython,
    createOrUpdatePredictionRun,
    createRouteFromPython,
    createRouteSolvability,
    updatePredictionRunCost,
    updatePredictionRunStats,
} from '@/lib/services/loaders/prediction-loader.service'
import { loadStockFromFile } from '@/lib/services/loaders/stock-loader.service'

import {
    carbonChainSmiles,
    cleanupTempFiles,
    countPythonMoleculeNodes,
    createBenchmarkSet,
    createFullModelChain,
    createTestBenchmarkGzFile,
    createTestCsvFile,
    makeConvergentPythonRoute,
    makeLinearPythonRoute,
    makeModelStatistics,
    syntheticInchiKey,
} from '../../../helpers/factories'

afterEach(() => {
    cleanupTempFiles()
})

// ============================================================================
// Full pipeline roundtrip
// ============================================================================

describe('loader roundtrip', () => {
    it('full pipeline: stock -> benchmark -> prediction -> solvability -> statistics', async () => {
        // ---- Step 1: Load stock ----
        const stockMolecules = [
            { smiles: carbonChainSmiles(1), inchikey: syntheticInchiKey('C') },
            { smiles: carbonChainSmiles(2), inchikey: syntheticInchiKey('CC') },
            { smiles: carbonChainSmiles(3), inchikey: syntheticInchiKey('CCC') },
        ]
        const csvPath = createTestCsvFile(stockMolecules)
        const stockResult = await loadStockFromFile(csvPath, 'roundtrip-stock')

        expect(stockResult.moleculesCreated).toBe(3)

        // ---- Step 2: Load benchmark ----
        const benchmark = await createBenchmarkSet({
            stockId: stockResult.stockId,
            name: 'roundtrip-benchmark',
        })

        // Create a benchmark route that reuses molecules from stock
        const benchRoute = makeLinearPythonRoute(2) // CCC <- CC <- C

        const benchData = {
            name: 'roundtrip-benchmark',
            targets: {
                'rt-001': {
                    id: 'rt-001',
                    smiles: benchRoute.target.smiles,
                    inchi_key: syntheticInchiKey(benchRoute.target.smiles),
                    acceptable_routes: [
                        {
                            target: benchRoute.target,
                            rank: 1,
                            signature: benchRoute.signature,
                            length: 2,
                            has_convergent_reaction: false,
                        },
                    ],
                },
            },
        }
        const gzPath = createTestBenchmarkGzFile(benchData)
        const benchResult = await loadBenchmarkFromFile(gzPath, benchmark.id, 'roundtrip-benchmark')

        expect(benchResult.targetsLoaded).toBe(1)
        expect(benchResult.routesCreated).toBe(1)
        // Molecules from route tree (C, CC, CCC) should be reused from stock
        // Only the target molecule itself (CCC) might be reused
        expect(benchResult.moleculesReused).toBeGreaterThanOrEqual(1)

        // ---- Step 3: Load prediction ----
        const { instance } = await createFullModelChain()
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id, {
            hourlyCost: 5.0,
        })

        // Get the benchmark target
        const target = await prisma.benchmarkTarget.findFirst({
            where: { benchmarkSetId: benchmark.id },
        })

        // Create the target molecule in prediction-loader style (should be deduplicated)
        await createMoleculeFromPython(benchRoute.target)

        // Predict the SAME route as the acceptable route (same signature)
        const predResult = await createRouteFromPython(benchRoute, run.id, target!.id)

        // Route should be reused from benchmark loading
        expect(predResult.wasReused).toBe(true)

        // No new route nodes created
        const totalNodes = await prisma.routeNode.count()
        expect(totalNodes).toBe(countPythonMoleculeNodes(benchRoute.target))

        // ---- Step 4: Solvability ----
        await createRouteSolvability(
            predResult.predictionRouteId,
            stockResult.stockId,
            true,
            true, // matches acceptable
            0, // matched index 0
            2, // stratification length
            false, // not convergent
            1.5, // wallTime
            3.0 // cpuTime
        )

        // ---- Step 5: Statistics ----
        const stats = makeModelStatistics({ totalWallTime: 3600 })
        await createModelStatistics(run.id, benchmark.id, stockResult.stockId, stats)

        // ---- Step 6: Cost and aggregate stats ----
        const costResult = await updatePredictionRunCost(run.id)
        expect(costResult).not.toBeNull()
        expect(costResult!.totalCost).toBe(5.0) // 5.0 * (3600/3600) = 5.0

        const statsResult = await updatePredictionRunStats(run.id)
        expect(statsResult.totalRoutes).toBe(1)
        expect(statsResult.avgRouteLength).toBe(2)

        // ---- Verify global invariants ----
        // No duplicate molecules
        const allMolecules = await prisma.molecule.findMany()
        const inchikeys = allMolecules.map((m) => m.inchikey)
        expect(inchikeys.length).toBe(new Set(inchikeys).size)

        // Only 1 Route record (shared between benchmark and prediction)
        const routeCount = await prisma.route.count()
        expect(routeCount).toBe(1)

        // 1 AcceptableRoute + 1 PredictionRoute both point to the same Route
        const acceptableRoutes = await prisma.acceptableRoute.findMany()
        const predictionRoutes = await prisma.predictionRoute.findMany()
        expect(acceptableRoutes).toHaveLength(1)
        expect(predictionRoutes).toHaveLength(1)
        expect(acceptableRoutes[0].routeId).toBe(predictionRoutes[0].routeId)
    })

    it('two models predict same target, same route — Route record reused, two PredictionRoutes', async () => {
        // Set up stock and benchmark
        const stockMolecules = [
            { smiles: carbonChainSmiles(1), inchikey: syntheticInchiKey('C') },
            { smiles: carbonChainSmiles(2), inchikey: syntheticInchiKey('CC') },
        ]
        const csvPath = createTestCsvFile(stockMolecules)
        const stockResult = await loadStockFromFile(csvPath, 'two-model-stock')

        const benchmark = await createBenchmarkSet({
            stockId: stockResult.stockId,
            name: 'two-model-benchmark',
        })

        // Load benchmark with a target (no acceptable routes this time)
        const targetSmiles = carbonChainSmiles(10)
        const benchData = {
            name: 'two-model-benchmark',
            targets: {
                'tm-001': {
                    id: 'tm-001',
                    smiles: targetSmiles,
                    inchi_key: syntheticInchiKey(targetSmiles),
                    acceptable_routes: [],
                },
            },
        }
        const gzPath = createTestBenchmarkGzFile(benchData)
        await loadBenchmarkFromFile(gzPath, benchmark.id, 'two-model-benchmark')

        const target = await prisma.benchmarkTarget.findFirst({
            where: { benchmarkSetId: benchmark.id },
        })

        // Two different models
        const { instance: model1 } = await createFullModelChain({ algorithmName: `ModelA-${Date.now()}` })
        const { instance: model2 } = await createFullModelChain({ algorithmName: `ModelB-${Date.now()}` })

        const run1 = await createOrUpdatePredictionRun(benchmark.id, model1.id)
        const run2 = await createOrUpdatePredictionRun(benchmark.id, model2.id)

        // Both models predict the same route
        const sharedRoute = makeLinearPythonRoute(1, 1)

        const pred1 = await createRouteFromPython(sharedRoute, run1.id, target!.id)
        const pred2 = await createRouteFromPython(sharedRoute, run2.id, target!.id)

        // Same Route record
        expect(pred2.routeId).toBe(pred1.routeId)
        expect(pred1.wasReused).toBe(false) // First one creates it
        expect(pred2.wasReused).toBe(true) // Second one reuses it

        // Different PredictionRoute records
        expect(pred2.predictionRouteId).not.toBe(pred1.predictionRouteId)

        // Global counts
        const routeCount = await prisma.route.count()
        expect(routeCount).toBe(1)

        const predRouteCount = await prisma.predictionRoute.count()
        expect(predRouteCount).toBe(2)

        // RouteNodes only created once
        const nodeCount = await prisma.routeNode.count()
        expect(nodeCount).toBe(countPythonMoleculeNodes(sharedRoute.target))
    })

    it('convergent route: isConvergent flag is consistent between benchmark-loader and prediction-loader', async () => {
        // Use makeConvergentPythonRoute which produces two non-leaf branches —
        // both loaders should agree this is convergent.
        const convergentRoute = makeConvergentPythonRoute(2)

        // --- Setup: stock ---
        const stockMolecules = [
            { smiles: carbonChainSmiles(1), inchikey: syntheticInchiKey('C') },
            { smiles: 'O', inchikey: syntheticInchiKey('O') },
        ]
        const csvPath = createTestCsvFile(stockMolecules)
        const stockResult = await loadStockFromFile(csvPath, 'conv-roundtrip-stock')

        // --- Setup: benchmark with convergent acceptable route ---
        const benchmark = await createBenchmarkSet({
            stockId: stockResult.stockId,
            name: 'conv-roundtrip-benchmark',
        })

        const benchData = {
            name: 'conv-roundtrip-benchmark',
            targets: {
                'conv-001': {
                    id: 'conv-001',
                    smiles: convergentRoute.target.smiles,
                    inchi_key: syntheticInchiKey(convergentRoute.target.smiles),
                    acceptable_routes: [
                        {
                            target: convergentRoute.target,
                            rank: 1,
                            signature: convergentRoute.signature,
                            // Omit length & has_convergent_reaction — force benchmark-loader to compute them
                        },
                    ],
                },
            },
        }
        const gzPath = createTestBenchmarkGzFile(benchData)
        await loadBenchmarkFromFile(gzPath, benchmark.id, 'conv-roundtrip-benchmark')

        // Verify benchmark-loader computed isConvergent = true
        const benchRoute = await prisma.route.findFirst()
        expect(benchRoute).not.toBeNull()
        expect(benchRoute!.isConvergent).toBe(true)
        expect(benchRoute!.length).toBe(2)

        // --- Prediction-loader: load the SAME convergent route ---
        const { instance } = await createFullModelChain({ algorithmName: `ConvModel-${Date.now()}` })
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)
        const target = await prisma.benchmarkTarget.findFirst({ where: { benchmarkSetId: benchmark.id } })

        const predResult = await createRouteFromPython(convergentRoute, run.id, target!.id)

        // Route is reused (same signature) — no new Route record created
        expect(predResult.wasReused).toBe(true)
        expect(predResult.routeId).toBe(benchRoute!.id)

        // The Route record's isConvergent (set by benchmark-loader) should be true
        const sharedRoute = await prisma.route.findUnique({ where: { id: predResult.routeId } })
        expect(sharedRoute!.isConvergent).toBe(true)

        // Only 1 Route record total
        const routeCount = await prisma.route.count()
        expect(routeCount).toBe(1)

        // RouteNodes created only once (by benchmark-loader)
        const nodeCount = await prisma.routeNode.count()
        expect(nodeCount).toBe(countPythonMoleculeNodes(convergentRoute.target))
    })
})
