/**
 * Tests for benchmark.service.ts
 *
 * Focus: Complex filtering/pagination logic and data transformations
 * - Complex query building with multiple filter conditions
 * - Pagination edge cases and boundary conditions
 * - Search functionality across multiple fields
 * - Error handling and validation
 * - Data consistency and cascading deletes
 *
 * Skip trivial operations: simple CRUD without logic
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import prisma from '@/lib/db'
import {
    createBenchmark,
    deleteBenchmark,
    getBenchmarkById,
    getBenchmarkSets,
    getBenchmarkStats,
    getBenchmarkTargets,
    getTargetById,
} from '@/lib/services/benchmark.service'

// ============================================================================
// Fixtures
// ============================================================================

/**
 * Create test molecules for use in benchmarks
 */
const createTestMolecules = async () => {
    const mol1 = await prisma.molecule.create({
        data: {
            smiles: 'CC(C)O',
            inchikey: 'LFQSCWFLJHTTHZ-UHFFFAOYSA-N',
        },
    })

    const mol2 = await prisma.molecule.create({
        data: {
            smiles: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O',
            inchikey: 'HEFNNWSMNKKCDL-UHFFFAOYSA-N',
        },
    })

    const mol3 = await prisma.molecule.create({
        data: {
            smiles: 'CCO',
            inchikey: 'LFQSCWFLJHTTHZ-UHFFFAOYSA-M',
        },
    })

    return { mol1, mol2, mol3 }
}

/**
 * Create a benchmark with targets
 */
const createTestBenchmark = async (
    name: string,
    options: {
        description?: string
        stockName?: string
        targetCount?: number
    } = {}
) => {
    const benchmark = await createBenchmark(name, options.description, options.stockName)
    const molecules = await createTestMolecules()

    const targets = []
    const targetCount = options.targetCount || 3

    for (let i = 0; i < targetCount; i++) {
        const mol = i === 0 ? molecules.mol1 : i === 1 ? molecules.mol2 : molecules.mol3
        const target = await prisma.benchmarkTarget.create({
            data: {
                benchmarkSetId: benchmark.id,
                targetId: `test-${i}-${Date.now()}`,
                moleculeId: mol.id,
                routeLength: i === 0 ? 3 : i === 1 ? 5 : null,
                isConvergent: i === 0 ? true : i === 1 ? false : null,
            },
        })
        targets.push(target)
    }

    return { benchmark, molecules, targets }
}

// ============================================================================
// Tests
// ============================================================================

describe('benchmark.service', () => {
    beforeEach(async () => {
        // Clean database in correct dependency order
        await prisma.$transaction([
            prisma.routeNode.deleteMany({}),
            prisma.route.deleteMany({}),
            prisma.benchmarkTarget.deleteMany({}),
            prisma.benchmarkSet.deleteMany({}),
            prisma.stockItem.deleteMany({}),
            prisma.molecule.deleteMany({}),
        ])
    })

    afterEach(async () => {
        // Clean database after each test
        await prisma.$transaction([
            prisma.routeNode.deleteMany({}),
            prisma.route.deleteMany({}),
            prisma.benchmarkTarget.deleteMany({}),
            prisma.benchmarkSet.deleteMany({}),
            prisma.stockItem.deleteMany({}),
            prisma.molecule.deleteMany({}),
        ])
    })

    describe('createBenchmark', () => {
        it('should create a benchmark with all fields', async () => {
            const result = await createBenchmark('test-bench', 'Test description', 'test-stock')

            expect(result.name).toBe('test-bench')
            expect(result.description).toBe('Test description')
            expect(result.stockName).toBe('test-stock')
            expect(result.id).toBeDefined()
        })

        it('should create a benchmark with minimal fields', async () => {
            const result = await createBenchmark('minimal-bench')

            expect(result.name).toBe('minimal-bench')
            expect(result.description).toBeNull()
            expect(result.stockName).toBeNull()
        })

        it('should throw error when duplicate name exists', async () => {
            await createBenchmark('duplicate-test')

            await expect(createBenchmark('duplicate-test')).rejects.toThrow(
                'A benchmark with name "duplicate-test" already exists.'
            )
        })
    })

    describe('getBenchmarkSets', () => {
        it('should return all benchmarks ordered by creation date descending', async () => {
            const bench1 = await createBenchmark('bench-1')
            const bench2 = await createBenchmark('bench-2')
            const bench3 = await createBenchmark('bench-3')

            const results = await getBenchmarkSets()

            expect(results).toHaveLength(3)
            // Should be ordered descending by createdAt
            // Get the names and check they are all present
            const names = results.map((b) => b.name)
            expect(names).toContain('bench-1')
            expect(names).toContain('bench-2')
            expect(names).toContain('bench-3')
            // Verify descending order: later created items first
            expect(results[0].createdAt.getTime()).toBeGreaterThanOrEqual(results[1].createdAt.getTime())
            expect(results[1].createdAt.getTime()).toBeGreaterThanOrEqual(results[2].createdAt.getTime())
        })

        it('should include target count for each benchmark', async () => {
            const { benchmark } = await createTestBenchmark('count-test', { targetCount: 5 })

            const results = await getBenchmarkSets()
            const found = results.find((b) => b.id === benchmark.id)

            expect(found).toBeDefined()
            expect(found?.targetCount).toBe(5)
        })

        it('should map null description to undefined', async () => {
            const benchmark = await createBenchmark('null-desc')

            const results = await getBenchmarkSets()
            const found = results.find((b) => b.id === benchmark.id)

            expect(found?.description).toBeUndefined()
        })

        it('should return empty array when no benchmarks exist', async () => {
            const results = await getBenchmarkSets()
            expect(results).toHaveLength(0)
        })
    })

    describe('getBenchmarkById', () => {
        it('should retrieve a benchmark with correct properties', async () => {
            const created = await createBenchmark('retrieve-test', 'A description', 'stock-name')

            const result = await getBenchmarkById(created.id)

            expect(result.id).toBe(created.id)
            expect(result.name).toBe('retrieve-test')
            expect(result.description).toBe('A description')
            expect(result.stockName).toBe('stock-name')
        })

        it('should include target count in result', async () => {
            const { benchmark } = await createTestBenchmark('count-test', { targetCount: 3 })

            const result = await getBenchmarkById(benchmark.id)

            expect(result.targetCount).toBe(3)
        })

        it('should throw error when benchmark not found', async () => {
            await expect(getBenchmarkById('nonexistent-id')).rejects.toThrow('Benchmark not found')
        })

        it('should return zero target count for empty benchmark', async () => {
            const benchmark = await createBenchmark('empty-bench')

            const result = await getBenchmarkById(benchmark.id)

            expect(result.targetCount).toBe(0)
        })
    })

    describe('getBenchmarkTargets - Pagination', () => {
        it('should paginate results correctly', async () => {
            const { benchmark } = await createTestBenchmark('pagination-test', { targetCount: 10 })

            const page1 = await getBenchmarkTargets(benchmark.id, 1, 3)
            const page2 = await getBenchmarkTargets(benchmark.id, 2, 3)

            expect(page1.targets).toHaveLength(3)
            expect(page2.targets).toHaveLength(3)
            expect(page1.targets[0].targetId).not.toBe(page2.targets[0].targetId)
        })

        it('should enforce maximum limit of 100', async () => {
            const { benchmark } = await createTestBenchmark('limit-test', { targetCount: 5 })

            const result = await getBenchmarkTargets(benchmark.id, 1, 200)

            expect(result.limit).toBe(100)
        })

        it('should enforce minimum limit of 1', async () => {
            const { benchmark } = await createTestBenchmark('min-limit-test', { targetCount: 5 })

            const result = await getBenchmarkTargets(benchmark.id, 1, 0)

            expect(result.limit).toBe(1)
        })

        it('should handle page number normalization', async () => {
            const { benchmark } = await createTestBenchmark('page-norm-test', { targetCount: 10 })

            const result = await getBenchmarkTargets(benchmark.id, -1, 5)

            expect(result.page).toBe(1)
        })

        it('should correctly detect hasMore flag', async () => {
            const { benchmark } = await createTestBenchmark('hasmore-test', { targetCount: 10 })

            const page1 = await getBenchmarkTargets(benchmark.id, 1, 5)
            const page2 = await getBenchmarkTargets(benchmark.id, 2, 5)
            const page3 = await getBenchmarkTargets(benchmark.id, 3, 5)

            expect(page1.hasMore).toBe(true)
            expect(page2.hasMore).toBe(false) // 5 + 5 = 10 total, so page 2 has no more
            expect(page3.total).toBe(10) // Total is still 10
        })

        it('should return correct total count', async () => {
            const { benchmark } = await createTestBenchmark('total-test', { targetCount: 7 })

            const result = await getBenchmarkTargets(benchmark.id, 1, 3)

            expect(result.total).toBe(7)
        })
    })

    describe('getBenchmarkTargets - Search by SMILES', () => {
        it('should find targets by SMILES substring', async () => {
            const { benchmark } = await createTestBenchmark('smiles-search', { targetCount: 1 })

            const result = await getBenchmarkTargets(benchmark.id, 1, 10, 'CC', 'smiles')

            expect(result.targets).toHaveLength(1)
            expect(result.targets[0].molecule.smiles).toContain('CC')
        })

        it('should not find targets with non-matching SMILES', async () => {
            const { benchmark } = await createTestBenchmark('no-smiles-match', { targetCount: 1 })

            const result = await getBenchmarkTargets(benchmark.id, 1, 10, 'XXXXX', 'smiles')

            expect(result.targets).toHaveLength(0)
        })

        it('should handle empty search query', async () => {
            const { benchmark } = await createTestBenchmark('empty-search', { targetCount: 3 })

            const result = await getBenchmarkTargets(benchmark.id, 1, 10, '', 'smiles')

            expect(result.targets).toHaveLength(3)
        })

        it('should handle whitespace-only search query', async () => {
            const { benchmark } = await createTestBenchmark('whitespace-search', { targetCount: 3 })

            const result = await getBenchmarkTargets(benchmark.id, 1, 10, '   ', 'smiles')

            expect(result.targets).toHaveLength(3)
        })
    })

    describe('getBenchmarkTargets - Search by InChiKey', () => {
        it('should find targets by InChiKey substring', async () => {
            const { benchmark } = await createTestBenchmark('inchikey-search', { targetCount: 1 })

            const result = await getBenchmarkTargets(benchmark.id, 1, 10, 'LFQSCWFLJHTTHZ', 'inchikey')

            expect(result.targets).toHaveLength(1)
            expect(result.targets[0].molecule.inchikey).toContain('LFQSCWFLJHTTHZ')
        })

        it('should not find targets with non-matching InChiKey', async () => {
            const { benchmark } = await createTestBenchmark('no-inchikey-match', { targetCount: 1 })

            const result = await getBenchmarkTargets(benchmark.id, 1, 10, 'XXXXXX', 'inchikey')

            expect(result.targets).toHaveLength(0)
        })
    })

    describe('getBenchmarkTargets - Search by Target ID', () => {
        it('should find targets by targetId substring', async () => {
            const { benchmark, targets } = await createTestBenchmark('targetid-search', {
                targetCount: 3,
            })

            const targetId = targets[0].targetId
            const searchTerm = targetId.substring(0, 8)

            const result = await getBenchmarkTargets(benchmark.id, 1, 10, searchTerm, 'targetId')

            expect(result.targets.length).toBeGreaterThan(0)
            expect(result.targets.some((t) => t.targetId.includes(searchTerm))).toBe(true)
        })
    })

    describe('getBenchmarkTargets - Search type all', () => {
        it('should search across SMILES, InChiKey, and targetId when searchType is all', async () => {
            await createTestBenchmark('search-all', { targetCount: 1 })

            const benchmarks = await getBenchmarkSets()
            const benchmark = benchmarks[0]

            const resultBySmiles = await getBenchmarkTargets(benchmark.id, 1, 10, 'CC', 'all')
            const resultByInchikey = await getBenchmarkTargets(benchmark.id, 1, 10, 'LFQSCWFLJHTTHZ', 'all')

            expect(resultBySmiles.targets.length).toBeGreaterThan(0)
            expect(resultByInchikey.targets.length).toBeGreaterThan(0)
        })
    })

    describe('getBenchmarkTargets - Filter by ground truth', () => {
        it('should filter targets with ground truth', async () => {
            const { benchmark, targets } = await createTestBenchmark('gt-filter', { targetCount: 3 })

            // Add ground truth route to first target
            const route = await prisma.route.create({
                data: {
                    targetId: targets[0].id,
                    rank: 1,
                    contentHash: 'test-hash',
                    length: 0,
                    isConvergent: false,
                },
            })

            await prisma.benchmarkTarget.update({
                where: { id: targets[0].id },
                data: { groundTruthRouteId: route.id },
            })

            const result = await getBenchmarkTargets(benchmark.id, 1, 10, undefined, 'all', true)

            expect(result.targets.length).toBeGreaterThan(0)
            expect(result.targets.every((t) => t.hasGroundTruth)).toBe(true)
        })

        it('should filter targets without ground truth', async () => {
            const { benchmark } = await createTestBenchmark('no-gt-filter', { targetCount: 3 })

            const result = await getBenchmarkTargets(benchmark.id, 1, 10, undefined, 'all', false)

            expect(result.targets.length).toBeGreaterThan(0)
            expect(result.targets.every((t) => !t.hasGroundTruth)).toBe(true)
        })
    })

    describe('getBenchmarkTargets - Filter by route length', () => {
        it('should filter targets by minimum route length', async () => {
            const { benchmark } = await createTestBenchmark('min-length-filter', { targetCount: 3 })

            const result = await getBenchmarkTargets(benchmark.id, 1, 10, undefined, 'all', undefined, 4)

            expect(result.targets.every((t) => t.routeLength === null || t.routeLength >= 4)).toBe(true)
        })

        it('should filter targets by maximum route length', async () => {
            const { benchmark } = await createTestBenchmark('max-length-filter', { targetCount: 3 })

            const result = await getBenchmarkTargets(benchmark.id, 1, 10, undefined, 'all', undefined, undefined, 4)

            expect(result.targets.every((t) => t.routeLength === null || t.routeLength <= 4)).toBe(true)
        })

        it('should filter targets by route length range', async () => {
            const { benchmark } = await createTestBenchmark('range-length-filter', { targetCount: 3 })

            const result = await getBenchmarkTargets(benchmark.id, 1, 10, undefined, 'all', undefined, 2, 4)

            expect(
                result.targets.every((t) => t.routeLength === null || (t.routeLength >= 2 && t.routeLength <= 4))
            ).toBe(true)
        })
    })

    describe('getBenchmarkTargets - Filter by convergence', () => {
        it('should filter targets by convergence', async () => {
            const { benchmark } = await createTestBenchmark('convergence-filter', { targetCount: 3 })

            const result = await getBenchmarkTargets(
                benchmark.id,
                1,
                10,
                undefined,
                'all',
                undefined,
                undefined,
                undefined,
                true
            )

            expect(result.targets.every((t) => t.isConvergent === null || t.isConvergent === true)).toBe(true)
        })

        it('should filter targets by non-convergence', async () => {
            const { benchmark } = await createTestBenchmark('non-convergence-filter', { targetCount: 3 })

            const result = await getBenchmarkTargets(
                benchmark.id,
                1,
                10,
                undefined,
                'all',
                undefined,
                undefined,
                undefined,
                false
            )

            expect(result.targets.every((t) => t.isConvergent === null || t.isConvergent === false)).toBe(true)
        })
    })

    describe('getBenchmarkTargets - Combined filters', () => {
        it('should apply multiple filters together', async () => {
            const { benchmark } = await createTestBenchmark('combined-filters', { targetCount: 5 })

            const result = await getBenchmarkTargets(benchmark.id, 1, 10, 'CC', 'smiles', true, 2, 4, true)

            expect(
                result.targets.every(
                    (t) =>
                        t.molecule.smiles.includes('CC') &&
                        t.hasGroundTruth &&
                        (t.routeLength === null || (t.routeLength >= 2 && t.routeLength <= 4)) &&
                        (t.isConvergent === null || t.isConvergent === true)
                )
            ).toBe(true)
        })
    })

    describe('getBenchmarkTargets - Error conditions', () => {
        it('should throw error when benchmark not found', async () => {
            await expect(getBenchmarkTargets('nonexistent-benchmark')).rejects.toThrow('Benchmark not found')
        })
    })

    describe('getTargetById', () => {
        it('should retrieve a target with molecule information', async () => {
            const { targets } = await createTestBenchmark('target-detail', {
                targetCount: 1,
            })

            const result = await getTargetById(targets[0].id)

            expect(result.id).toBe(targets[0].id)
            expect(result.targetId).toBe(targets[0].targetId)
            expect(result.molecule).toBeDefined()
            expect(result.molecule.smiles).toBeDefined()
        })

        it('should include hasGroundTruth flag', async () => {
            const { targets } = await createTestBenchmark('gt-flag-test', {
                targetCount: 1,
            })

            const result = await getTargetById(targets[0].id)

            expect(result.hasGroundTruth).toBe(false)
        })

        it('should throw error when target not found', async () => {
            await expect(getTargetById('nonexistent-target')).rejects.toThrow('Benchmark target not found')
        })

        it('should include all target properties', async () => {
            const { targets } = await createTestBenchmark('all-props-test', { targetCount: 1 })

            const result = await getTargetById(targets[0].id)

            expect(result.id).toBeDefined()
            expect(result.benchmarkSetId).toBeDefined()
            expect(result.targetId).toBeDefined()
            expect(result.moleculeId).toBeDefined()
            expect(result.molecule).toBeDefined()
        })
    })

    describe('getBenchmarkStats', () => {
        it('should compute correct stats for benchmark', async () => {
            const { benchmark } = await createTestBenchmark('stats-test', { targetCount: 3 })

            const stats = await getBenchmarkStats(benchmark.id)

            expect(stats.totalTargets).toBe(3)
        })

        it('should count targets with ground truth', async () => {
            const { benchmark, targets } = await createTestBenchmark('gt-count-test', { targetCount: 3 })

            const route = await prisma.route.create({
                data: {
                    targetId: targets[0].id,
                    rank: 1,
                    contentHash: 'test-hash',
                    length: 0,
                    isConvergent: false,
                },
            })

            await prisma.benchmarkTarget.update({
                where: { id: targets[0].id },
                data: { groundTruthRouteId: route.id },
            })

            const stats = await getBenchmarkStats(benchmark.id)

            expect(stats.targetsWithGroundTruth).toBe(1)
        })

        it('should compute average route length correctly', async () => {
            const { benchmark } = await createTestBenchmark('avg-length-test', { targetCount: 3 })

            const stats = await getBenchmarkStats(benchmark.id)

            // Targets have routeLength of 3, 5, null
            // Average should be (3 + 5) / 2 = 4
            expect(stats.avgRouteLength).toBe(4)
        })

        it('should count convergent routes', async () => {
            const { benchmark } = await createTestBenchmark('convergent-count-test', {
                targetCount: 3,
            })

            const stats = await getBenchmarkStats(benchmark.id)

            // Only first target (index 0) is convergent
            expect(stats.convergentRoutes).toBe(1)
        })

        it('should compute min and max route lengths', async () => {
            const { benchmark } = await createTestBenchmark('minmax-test', { targetCount: 3 })

            const stats = await getBenchmarkStats(benchmark.id)

            expect(stats.minRouteLength).toBe(3)
            expect(stats.maxRouteLength).toBe(5)
        })

        it('should return zero stats for empty benchmark', async () => {
            const benchmark = await createBenchmark('empty-stats-test')

            const stats = await getBenchmarkStats(benchmark.id)

            expect(stats.totalTargets).toBe(0)
            expect(stats.targetsWithGroundTruth).toBe(0)
            expect(stats.avgRouteLength).toBe(0)
            expect(stats.convergentRoutes).toBe(0)
            expect(stats.minRouteLength).toBe(0)
            expect(stats.maxRouteLength).toBe(0)
        })

        it('should throw error when benchmark not found', async () => {
            await expect(getBenchmarkStats('nonexistent-id')).rejects.toThrow('Benchmark not found')
        })
    })

    describe('deleteBenchmark', () => {
        it('should delete benchmark and all its targets', async () => {
            const { benchmark } = await createTestBenchmark('delete-test', { targetCount: 3 })

            await deleteBenchmark(benchmark.id)

            const deleted = await prisma.benchmarkSet.findUnique({
                where: { id: benchmark.id },
            })
            expect(deleted).toBeNull()

            const targets = await prisma.benchmarkTarget.findMany({
                where: { benchmarkSetId: benchmark.id },
            })
            expect(targets).toHaveLength(0)
        })

        it('should cascade delete routes when benchmark is deleted', async () => {
            const { benchmark, targets } = await createTestBenchmark('cascade-delete-test', {
                targetCount: 1,
            })

            // Create a route for the target
            const route = await prisma.route.create({
                data: {
                    targetId: targets[0].id,
                    rank: 1,
                    contentHash: 'test-hash',
                    length: 2,
                    isConvergent: false,
                },
            })

            const routeId = route.id

            await deleteBenchmark(benchmark.id)

            const deletedRoute = await prisma.route.findUnique({
                where: { id: routeId },
            })
            expect(deletedRoute).toBeNull()
        })

        it('should cascade delete route nodes when benchmark is deleted', async () => {
            const { benchmark, targets } = await createTestBenchmark('cascade-nodes-test', {
                targetCount: 1,
            })

            const route = await prisma.route.create({
                data: {
                    targetId: targets[0].id,
                    rank: 1,
                    contentHash: 'test-hash',
                    length: 1,
                    isConvergent: false,
                },
            })

            // Create molecules for nodes
            const mol1 = await prisma.molecule.create({
                data: {
                    smiles: 'C',
                    inchikey: 'NODE-TEST-1',
                },
            })

            const node = await prisma.routeNode.create({
                data: {
                    routeId: route.id,
                    moleculeId: mol1.id,
                    isLeaf: true,
                },
            })

            const nodeId = node.id

            await deleteBenchmark(benchmark.id)

            const deletedNode = await prisma.routeNode.findUnique({
                where: { id: nodeId },
            })
            expect(deletedNode).toBeNull()
        })

        it('should throw error when benchmark not found', async () => {
            await expect(deleteBenchmark('nonexistent-id')).rejects.toThrow('Benchmark not found')
        })
    })
})
