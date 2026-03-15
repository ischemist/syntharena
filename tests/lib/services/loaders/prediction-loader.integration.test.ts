/**
 * Integration tests for prediction-loader.service.ts database operations.
 *
 * Tests createOrUpdatePredictionRun, createMoleculeFromPython, createRouteFromPython,
 * createRouteSolvability, createModelStatistics, updatePredictionRunCost,
 * and updatePredictionRunStats against a real SQLite test database.
 */

import { describe, expect, it } from 'vitest'

import prisma from '@/lib/db'
import {
    createModelStatistics,
    createMoleculeFromPython,
    createOrUpdatePredictionRun,
    createRouteFromPython,
    createRouteSolvability,
    updatePredictionRunCost,
    updatePredictionRunStats,
} from '@/lib/services/loaders/prediction-loader.service'

import {
    carbonChainSmiles,
    countPythonMoleculeNodes,
    createBenchmarkSet,
    createBenchmarkTarget,
    createFullModelChain,
    createMolecule,
    createStock,
    makeConvergentPythonRoute,
    makeLeafMolecule,
    makeLinearPythonRoute,
    makeModelStatistics,
    makeStratifiedMetric,
} from '../../../helpers/factories'

// ============================================================================
// Helper: set up a full prediction run context
// ============================================================================

async function setupPredictionContext() {
    const stock = await createStock({ name: `pred-stock-${Date.now()}` })
    const { instance } = await createFullModelChain()
    const benchmark = await createBenchmarkSet({ stockId: stock.id })
    const targetMolecule = await createMolecule({ smiles: carbonChainSmiles(5) })
    const target = await createBenchmarkTarget({
        benchmarkSetId: benchmark.id,
        moleculeId: targetMolecule.id,
    })

    return { stock, instance, benchmark, targetMolecule, target }
}

// ============================================================================
// createOrUpdatePredictionRun
// ============================================================================

describe('createOrUpdatePredictionRun', () => {
    it('creates a new prediction run', async () => {
        const { instance, benchmark } = await setupPredictionContext()

        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)

        expect(run.id).toBeDefined()
        expect(run.benchmarkSetId).toBe(benchmark.id)
        expect(run.modelInstanceId).toBe(instance.id)

        // Verify in DB
        const dbRun = await prisma.predictionRun.findUnique({ where: { id: run.id } })
        expect(dbRun).not.toBeNull()
        expect(dbRun!.totalRoutes).toBe(0)
    })

    it('upserts (updates) existing run for same model+benchmark', async () => {
        const { instance, benchmark } = await setupPredictionContext()

        const run1 = await createOrUpdatePredictionRun(benchmark.id, instance.id, {
            retrocastVersion: '1.0.0',
        })
        const run2 = await createOrUpdatePredictionRun(benchmark.id, instance.id, {
            retrocastVersion: '1.1.0',
        })

        // Same ID — was upserted
        expect(run2.id).toBe(run1.id)

        // Version updated
        const dbRun = await prisma.predictionRun.findUnique({ where: { id: run1.id } })
        expect(dbRun!.retrocastVersion).toBe('1.1.0')

        // Only 1 run in DB
        const allRuns = await prisma.predictionRun.findMany()
        expect(allRuns).toHaveLength(1)
    })

    it('throws if benchmark does not exist', async () => {
        const { instance } = await setupPredictionContext()

        await expect(createOrUpdatePredictionRun('nonexistent-benchmark', instance.id)).rejects.toThrow(
            'Benchmark not found'
        )
    })

    it('throws if model instance does not exist', async () => {
        const { benchmark } = await setupPredictionContext()

        await expect(createOrUpdatePredictionRun(benchmark.id, 'nonexistent-model')).rejects.toThrow(
            'Model instance not found'
        )
    })
})

// ============================================================================
// createMoleculeFromPython
// ============================================================================

describe('createMoleculeFromPython', () => {
    it('creates a new molecule', async () => {
        const pyMol = makeLeafMolecule(carbonChainSmiles(7))

        const result = await createMoleculeFromPython(pyMol)

        expect(result.id).toBeDefined()
        expect(result.inchikey).toBe(pyMol.inchikey)
        expect(result.smiles).toBe(pyMol.smiles)

        // Verify in DB
        const dbMol = await prisma.molecule.findUnique({ where: { inchikey: pyMol.inchikey } })
        expect(dbMol).not.toBeNull()
    })

    it('returns existing molecule on duplicate inchikey (upsert)', async () => {
        const pyMol = makeLeafMolecule(carbonChainSmiles(8))

        const first = await createMoleculeFromPython(pyMol)
        const second = await createMoleculeFromPython(pyMol)

        expect(second.id).toBe(first.id)

        // Only 1 molecule in DB
        const count = await prisma.molecule.count()
        expect(count).toBe(1)
    })
})

// ============================================================================
// createRouteFromPython
// ============================================================================

describe('createRouteFromPython', () => {
    it('creates new Route + RouteNode tree + PredictionRoute', async () => {
        const { instance, benchmark, target } = await setupPredictionContext()
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)

        const pyRoute = makeLinearPythonRoute(2, 1) // CCC <- CC <- C

        const result = await createRouteFromPython(pyRoute, run.id, target.id)

        expect(result.routeId).toBeDefined()
        expect(result.predictionRouteId).toBeDefined()
        expect(result.rank).toBe(1)
        expect(result.wasReused).toBe(false)

        // Verify Route in DB
        const dbRoute = await prisma.route.findUnique({ where: { id: result.routeId } })
        expect(dbRoute!.signature).toBe(pyRoute.signature)
        expect(dbRoute!.length).toBe(2)
        expect(dbRoute!.isConvergent).toBe(false)

        // Verify RouteNodes
        const nodes = await prisma.routeNode.findMany({ where: { routeId: result.routeId } })
        expect(nodes).toHaveLength(countPythonMoleculeNodes(pyRoute.target))

        // Verify PredictionRoute junction
        const predRoute = await prisma.predictionRoute.findUnique({ where: { id: result.predictionRouteId } })
        expect(predRoute!.routeId).toBe(result.routeId)
        expect(predRoute!.predictionRunId).toBe(run.id)
        expect(predRoute!.targetId).toBe(target.id)
    })

    it('deduplicates route by signature — reuses Route, creates new PredictionRoute', async () => {
        // Set up two different prediction runs (two different models)
        const stock = await createStock({ name: `dedup-stock-${Date.now()}` })
        const { instance: instance1 } = await createFullModelChain({ algorithmName: `Algo1-${Date.now()}` })
        const { instance: instance2 } = await createFullModelChain({ algorithmName: `Algo2-${Date.now()}` })
        const benchmark = await createBenchmarkSet({ stockId: stock.id })
        const mol = await createMolecule({ smiles: carbonChainSmiles(5) })
        const target = await createBenchmarkTarget({ benchmarkSetId: benchmark.id, moleculeId: mol.id })

        const run1 = await createOrUpdatePredictionRun(benchmark.id, instance1.id)
        const run2 = await createOrUpdatePredictionRun(benchmark.id, instance2.id)

        const pyRoute = makeLinearPythonRoute(1, 1)

        const result1 = await createRouteFromPython(pyRoute, run1.id, target.id)
        const result2 = await createRouteFromPython(pyRoute, run2.id, target.id)

        // Same Route record reused
        expect(result2.routeId).toBe(result1.routeId)
        expect(result2.wasReused).toBe(true)

        // Different PredictionRoute records
        expect(result2.predictionRouteId).not.toBe(result1.predictionRouteId)

        // Only 1 Route in DB
        const routeCount = await prisma.route.count()
        expect(routeCount).toBe(1)

        // But 2 PredictionRoutes
        const predRouteCount = await prisma.predictionRoute.count()
        expect(predRouteCount).toBe(2)

        // RouteNodes created only once
        const nodeCount = await prisma.routeNode.count()
        expect(nodeCount).toBe(countPythonMoleculeNodes(pyRoute.target))
    })

    it('throws on duplicate prediction (same route+run+target)', async () => {
        const { instance, benchmark, target } = await setupPredictionContext()
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)

        const pyRoute = makeLinearPythonRoute(1, 1)

        await createRouteFromPython(pyRoute, run.id, target.id)

        await expect(createRouteFromPython(pyRoute, run.id, target.id)).rejects.toThrow('Duplicate prediction')
    })

    it('stores correct node count for various topologies', async () => {
        const { instance, benchmark, target } = await setupPredictionContext()
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)

        const convergentRoute = makeConvergentPythonRoute(2, 1)
        const result = await createRouteFromPython(convergentRoute, run.id, target.id)

        const nodes = await prisma.routeNode.findMany({ where: { routeId: result.routeId } })
        expect(nodes).toHaveLength(countPythonMoleculeNodes(convergentRoute.target))
    })

    it('computes correct length and isConvergent for convergent route', async () => {
        const { instance, benchmark, target } = await setupPredictionContext()
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)

        const convergentRoute = makeConvergentPythonRoute(3, 1)
        const result = await createRouteFromPython(convergentRoute, run.id, target.id)

        const dbRoute = await prisma.route.findUnique({ where: { id: result.routeId } })
        expect(dbRoute!.length).toBe(3)
        expect(dbRoute!.isConvergent).toBe(true)
    })

    it('throws if target does not exist', async () => {
        const { instance, benchmark } = await setupPredictionContext()
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)
        const pyRoute = makeLinearPythonRoute(1, 1)

        await expect(createRouteFromPython(pyRoute, run.id, 'nonexistent-target')).rejects.toThrow('Target not found')
    })

    it('stores convergent route with proper node relationships', async () => {
        const { instance, benchmark, target } = await setupPredictionContext()
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)

        const convergentRoute = makeConvergentPythonRoute(2, 1)
        const result = await createRouteFromPython(convergentRoute, run.id, target.id)

        const nodes = await prisma.routeNode.findMany({
            where: { routeId: result.routeId },
            include: { molecule: true },
        })

        // Find root (no parent)
        const root = nodes.find((n) => n.parentId === null)
        expect(root).toBeDefined()
        expect(root!.isLeaf).toBe(false)

        // Root should have 2 children (convergent — two branches)
        const rootChildren = nodes.filter((n) => n.parentId === root!.id)
        expect(rootChildren).toHaveLength(2)

        // Each branch has a leaf
        const leafNodes = nodes.filter((n) => n.isLeaf)
        expect(leafNodes.length).toBeGreaterThanOrEqual(2)
    })
})

// ============================================================================
// createRouteSolvability
// ============================================================================

describe('createRouteSolvability', () => {
    it('creates solvability record', async () => {
        const { instance, benchmark, target, stock } = await setupPredictionContext()
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)
        const pyRoute = makeLinearPythonRoute(1, 1)
        const { predictionRouteId } = await createRouteFromPython(pyRoute, run.id, target.id)

        const result = await createRouteSolvability(
            predictionRouteId,
            stock.id,
            true, // isSolvable
            false, // matchesAcceptable
            null, // matchedAcceptableIndex
            1, // stratificationLength
            false, // stratificationIsConvergent
            1.5, // wallTime
            3.0 // cpuTime
        )

        expect(result.id).toBeDefined()
        expect(result.predictionRouteId).toBe(predictionRouteId)
        expect(result.stockId).toBe(stock.id)

        // Verify in DB
        const dbSolv = await prisma.routeSolvability.findUnique({ where: { id: result.id } })
        expect(dbSolv!.isSolvable).toBe(true)
        expect(dbSolv!.matchesAcceptable).toBe(false)
        expect(dbSolv!.stratificationLength).toBe(1)
        expect(dbSolv!.wallTime).toBe(1.5)
        expect(dbSolv!.cpuTime).toBe(3.0)
    })

    it('upserts on duplicate predictionRouteId+stockId', async () => {
        const { instance, benchmark, target, stock } = await setupPredictionContext()
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)
        const pyRoute = makeLinearPythonRoute(1, 1)
        const { predictionRouteId } = await createRouteFromPython(pyRoute, run.id, target.id)

        // First call
        await createRouteSolvability(predictionRouteId, stock.id, false, false, null, null, null, null, null)

        // Second call (upsert) — should update
        const result2 = await createRouteSolvability(predictionRouteId, stock.id, true, true, 0, 1, false, 2.0, 4.0)

        // Only 1 record
        const count = await prisma.routeSolvability.count()
        expect(count).toBe(1)

        // Values updated
        const dbSolv = await prisma.routeSolvability.findUnique({ where: { id: result2.id } })
        expect(dbSolv!.isSolvable).toBe(true)
        expect(dbSolv!.matchesAcceptable).toBe(true)
        expect(dbSolv!.matchedAcceptableIndex).toBe(0)
    })

    it('throws if predictionRoute does not exist', async () => {
        const stock = await createStock()

        await expect(
            createRouteSolvability('nonexistent-pred-route', stock.id, true, false, null, null, null, null, null)
        ).rejects.toThrow('PredictionRoute not found')
    })

    it('throws if stock does not exist', async () => {
        const { instance, benchmark, target } = await setupPredictionContext()
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)
        const pyRoute = makeLinearPythonRoute(1, 1)
        const { predictionRouteId } = await createRouteFromPython(pyRoute, run.id, target.id)

        await expect(
            createRouteSolvability(predictionRouteId, 'nonexistent-stock', true, false, null, null, null, null, null)
        ).rejects.toThrow('Stock not found')
    })
})

// ============================================================================
// createModelStatistics
// ============================================================================

describe('createModelStatistics', () => {
    it('creates statistics and stratified metric groups', async () => {
        const { instance, benchmark, stock } = await setupPredictionContext()
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)

        const stats = makeModelStatistics({
            solvability: makeStratifiedMetric({
                metricName: 'Solvability',
                byGroup: {
                    2: {
                        value: 0.8,
                        ciLower: 0.7,
                        ciUpper: 0.9,
                        nSamples: 50,
                        reliability: { code: 'OK', message: 'OK' },
                    },
                    3: {
                        value: 0.6,
                        ciLower: 0.5,
                        ciUpper: 0.7,
                        nSamples: 30,
                        reliability: { code: 'LOW_N', message: 'Low N' },
                    },
                },
            }),
        })

        const result = await createModelStatistics(run.id, benchmark.id, stock.id, stats)

        expect(result.id).toBeDefined()
        expect(result.predictionRunId).toBe(run.id)
        expect(result.stockId).toBe(stock.id)

        // Verify ModelRunStatistics in DB
        const dbStats = await prisma.modelRunStatistics.findUnique({ where: { id: result.id } })
        expect(dbStats).not.toBeNull()
        expect(dbStats!.statisticsJson).toBeTruthy()

        // Verify StratifiedMetricGroups
        const metrics = await prisma.stratifiedMetricGroup.findMany({
            where: { statisticsId: result.id },
            orderBy: { groupKey: 'asc' },
        })
        // 1 overall (null groupKey) + 2 stratified = 3 total
        expect(metrics).toHaveLength(3)

        const overall = metrics.find((m) => m.groupKey === null)
        expect(overall!.metricName).toBe('Solvability')
        expect(overall!.value).toBe(0.75)

        const group2 = metrics.find((m) => m.groupKey === 2)
        expect(group2!.value).toBe(0.8)
        expect(group2!.reliabilityCode).toBe('OK')

        const group3 = metrics.find((m) => m.groupKey === 3)
        expect(group3!.value).toBe(0.6)
        expect(group3!.reliabilityCode).toBe('LOW_N')
    })

    it('replaces existing stats on re-run (delete + create)', async () => {
        const { instance, benchmark, stock } = await setupPredictionContext()
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)

        const stats1 = makeModelStatistics()
        const stats2 = makeModelStatistics({
            solvability: makeStratifiedMetric({
                overall: {
                    value: 0.99,
                    ciLower: 0.95,
                    ciUpper: 1.0,
                    nSamples: 200,
                    reliability: { code: 'OK', message: 'OK' },
                },
            }),
        })

        const result1 = await createModelStatistics(run.id, benchmark.id, stock.id, stats1)
        const result2 = await createModelStatistics(run.id, benchmark.id, stock.id, stats2)

        // Different IDs (old deleted, new created)
        expect(result2.id).not.toBe(result1.id)

        // Only 1 statistics record
        const count = await prisma.modelRunStatistics.count()
        expect(count).toBe(1)

        // Value updated to new stats
        const dbStats = await prisma.modelRunStatistics.findUnique({ where: { id: result2.id } })
        const parsed = JSON.parse(dbStats!.statisticsJson)
        expect(parsed.solvability.overall.value).toBe(0.99)
    })

    it('stores correct metric count for stats with topKAccuracy', async () => {
        const { instance, benchmark, stock } = await setupPredictionContext()
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)

        const stats = makeModelStatistics({
            topKAccuracy: {
                '1': makeStratifiedMetric({ metricName: 'Top-1' }),
                '5': makeStratifiedMetric({ metricName: 'Top-5' }),
            },
        })

        const result = await createModelStatistics(run.id, benchmark.id, stock.id, stats)

        const metrics = await prisma.stratifiedMetricGroup.findMany({
            where: { statisticsId: result.id },
        })
        // 1 solvability overall + 1 Top-1 overall + 1 Top-5 overall = 3
        expect(metrics).toHaveLength(3)

        const metricNames = [...new Set(metrics.map((m) => m.metricName))].sort()
        expect(metricNames).toEqual(['Solvability', 'Top-1', 'Top-5'])
    })

    it('throws if prediction run does not exist', async () => {
        const { benchmark, stock } = await setupPredictionContext()

        await expect(
            createModelStatistics('nonexistent-run', benchmark.id, stock.id, makeModelStatistics())
        ).rejects.toThrow('Prediction run not found')
    })

    it('throws if stock does not exist', async () => {
        const { instance, benchmark } = await setupPredictionContext()
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)

        await expect(
            createModelStatistics(run.id, benchmark.id, 'nonexistent-stock', makeModelStatistics())
        ).rejects.toThrow('Stock not found')
    })

    it('stores runtime metrics at top level', async () => {
        const { instance, benchmark, stock } = await setupPredictionContext()
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)

        const stats = makeModelStatistics({
            totalWallTime: 3600,
            totalCpuTime: 7200,
            meanWallTime: 12.5,
            meanCpuTime: 25.0,
        })

        const result = await createModelStatistics(run.id, benchmark.id, stock.id, stats)

        const dbStats = await prisma.modelRunStatistics.findUnique({ where: { id: result.id } })
        expect(dbStats!.totalWallTime).toBe(3600)
        expect(dbStats!.totalCpuTime).toBe(7200)
        expect(dbStats!.meanWallTime).toBe(12.5)
        expect(dbStats!.meanCpuTime).toBe(25.0)
    })
})

// ============================================================================
// updatePredictionRunCost
// ============================================================================

describe('updatePredictionRunCost', () => {
    it('calculates cost = hourlyCost * (wallTime / 3600)', async () => {
        const { instance, benchmark, stock } = await setupPredictionContext()
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id, {
            hourlyCost: 10.0,
        })

        // Create statistics with totalWallTime = 1800 seconds (0.5 hours)
        const stats = makeModelStatistics({ totalWallTime: 1800 })
        await createModelStatistics(run.id, benchmark.id, stock.id, stats)

        const result = await updatePredictionRunCost(run.id)

        expect(result).not.toBeNull()
        expect(result!.hourlyCost).toBe(10.0)
        expect(result!.totalCost).toBe(5.0) // 10.0 * (1800/3600) = 5.0
    })

    it('returns null when no hourlyCost', async () => {
        const { instance, benchmark } = await setupPredictionContext()
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)
        // No hourlyCost set

        const result = await updatePredictionRunCost(run.id)

        expect(result).toBeNull()
    })

    it('returns null when no totalWallTime in statistics', async () => {
        const { instance, benchmark, stock } = await setupPredictionContext()
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id, {
            hourlyCost: 10.0,
        })

        // Create statistics without totalWallTime
        const stats = makeModelStatistics({ totalWallTime: null })
        await createModelStatistics(run.id, benchmark.id, stock.id, stats)

        const result = await updatePredictionRunCost(run.id)

        expect(result).toBeNull()
    })

    it('throws if run does not exist', async () => {
        await expect(updatePredictionRunCost('nonexistent-run')).rejects.toThrow('Prediction run not found')
    })
})

// ============================================================================
// updatePredictionRunStats
// ============================================================================

describe('updatePredictionRunStats', () => {
    it('computes totalRoutes and avgRouteLength from PredictionRoutes', async () => {
        const { instance, benchmark, target } = await setupPredictionContext()
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)

        // Add two routes with different lengths
        const route1 = makeLinearPythonRoute(2, 1) // length 2
        const route2 = makeLinearPythonRoute(4, 2) // length 4

        await createRouteFromPython(route1, run.id, target.id)
        await createRouteFromPython(route2, run.id, target.id)

        const result = await updatePredictionRunStats(run.id)

        expect(result.totalRoutes).toBe(2)
        expect(result.avgRouteLength).toBe(3) // (2 + 4) / 2 = 3
    })

    it('returns 0 for empty run (no predictions)', async () => {
        const { instance, benchmark } = await setupPredictionContext()
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)

        const result = await updatePredictionRunStats(run.id)

        expect(result.totalRoutes).toBe(0)
        expect(result.avgRouteLength).toBe(0)
    })

    it('throws if run does not exist', async () => {
        await expect(updatePredictionRunStats('nonexistent-run')).rejects.toThrow('Prediction run not found')
    })
})
