/**
 * Integration tests for benchmark-loader.service.ts
 *
 * Tests loading benchmark sets from gzipped JSON files,
 * route deduplication by signature, route tree storage,
 * and acceptable route management against a real SQLite test database.
 */

import { afterEach, describe, expect, it } from 'vitest'

import prisma from '@/lib/db'
import { loadBenchmarkFromFile } from '@/lib/services/loaders/benchmark-loader.service'
import { loadStockFromFile } from '@/lib/services/loaders/stock-loader.service'

import {
    carbonChainSmiles,
    cleanupTempFiles,
    createBenchmarkSet,
    createStock,
    createTestBenchmarkGzFile,
    createTestCsvFile,
    makeConvergentPythonRoute,
    makeLeafMolecule,
    makeLinearPythonRoute,
    syntheticInchiKey,
} from '../../../helpers/factories'

afterEach(() => {
    cleanupTempFiles()
})

// Helper: build a benchmark target entry with acceptable routes
function makeBenchmarkTarget(
    id: string,
    smiles: string,
    acceptableRoutes: Array<{
        target: ReturnType<typeof makeLeafMolecule>
        rank: number
        content_hash?: string
        signature?: string
        length?: number
        has_convergent_reaction?: boolean
    }> = []
) {
    return {
        id,
        smiles,
        inchi_key: syntheticInchiKey(smiles),
        acceptable_routes: acceptableRoutes,
    }
}

// ============================================================================
// loadBenchmarkFromFile — basic target loading
// ============================================================================

describe('loadBenchmarkFromFile', () => {
    it('loads targets with no acceptable routes', async () => {
        const stock = await createStock({ name: 'bench-stock-1' })
        const benchmark = await createBenchmarkSet({ stockId: stock.id, name: 'bench-no-routes' })

        const data = {
            name: 'bench-no-routes',
            targets: {
                't-001': makeBenchmarkTarget('t-001', carbonChainSmiles(5)),
                't-002': makeBenchmarkTarget('t-002', carbonChainSmiles(6)),
            },
        }
        const filePath = createTestBenchmarkGzFile(data)

        const result = await loadBenchmarkFromFile(filePath, benchmark.id, 'bench-no-routes')

        expect(result.targetsLoaded).toBe(2)
        expect(result.routesCreated).toBe(0)

        // Verify targets in DB
        const targets = await prisma.benchmarkTarget.findMany({
            where: { benchmarkSetId: benchmark.id },
        })
        expect(targets).toHaveLength(2)
        expect(targets.map((t) => t.targetId).sort()).toEqual(['t-001', 't-002'])

        // hasAcceptableRoutes should remain false
        const updatedBench = await prisma.benchmarkSet.findUnique({ where: { id: benchmark.id } })
        expect(updatedBench!.hasAcceptableRoutes).toBe(false)
    })

    it('loads targets with acceptable routes — creates Route, RouteNodes, AcceptableRoute', async () => {
        const stock = await createStock({ name: 'bench-stock-2' })
        const benchmark = await createBenchmarkSet({ stockId: stock.id, name: 'bench-with-routes' })

        const route = makeLinearPythonRoute(2) // CCC <- CC <- C

        const data = {
            name: 'bench-with-routes',
            targets: {
                't-001': {
                    id: 't-001',
                    smiles: route.target.smiles,
                    inchi_key: syntheticInchiKey(route.target.smiles),
                    acceptable_routes: [
                        {
                            target: route.target,
                            rank: 1,
                            content_hash: route.content_hash,
                            signature: route.signature,
                            length: 2,
                            has_convergent_reaction: false,
                        },
                    ],
                },
            },
        }
        const filePath = createTestBenchmarkGzFile(data)

        const result = await loadBenchmarkFromFile(filePath, benchmark.id, 'bench-with-routes')

        expect(result.targetsLoaded).toBe(1)
        expect(result.routesCreated).toBe(1)

        // Verify Route in DB
        const routes = await prisma.route.findMany()
        expect(routes).toHaveLength(1)
        expect(routes[0].signature).toBe(route.signature)
        expect(routes[0].length).toBe(2)
        expect(routes[0].isConvergent).toBe(false)

        // Verify RouteNodes exist
        const nodes = await prisma.routeNode.findMany({ where: { routeId: routes[0].id } })
        expect(nodes.length).toBe(3) // CCC (root) + CC + C (leaf)

        // Verify AcceptableRoute junction
        const acceptableRoutes = await prisma.acceptableRoute.findMany()
        expect(acceptableRoutes).toHaveLength(1)
        expect(acceptableRoutes[0].routeIndex).toBe(0)

        // hasAcceptableRoutes should be true
        const updatedBench = await prisma.benchmarkSet.findUnique({ where: { id: benchmark.id } })
        expect(updatedBench!.hasAcceptableRoutes).toBe(true)
    })

    it('deduplicates routes by signature — same route in two targets reuses Route record', async () => {
        const stock = await createStock({ name: 'bench-stock-dedup' })
        const benchmark = await createBenchmarkSet({ stockId: stock.id, name: 'bench-dedup' })

        const route = makeLinearPythonRoute(1) // CC <- C

        // Two different targets share the same acceptable route (same signature)
        const target1Smiles = carbonChainSmiles(10)
        const target2Smiles = carbonChainSmiles(11)

        const data = {
            name: 'bench-dedup',
            targets: {
                't-001': {
                    id: 't-001',
                    smiles: target1Smiles,
                    inchi_key: syntheticInchiKey(target1Smiles),
                    acceptable_routes: [
                        {
                            target: route.target,
                            rank: 1,
                            content_hash: route.content_hash,
                            signature: route.signature,
                            length: 1,
                            has_convergent_reaction: false,
                        },
                    ],
                },
                't-002': {
                    id: 't-002',
                    smiles: target2Smiles,
                    inchi_key: syntheticInchiKey(target2Smiles),
                    acceptable_routes: [
                        {
                            target: route.target,
                            rank: 1,
                            content_hash: route.content_hash,
                            signature: route.signature,
                            length: 1,
                            has_convergent_reaction: false,
                        },
                    ],
                },
            },
        }
        const filePath = createTestBenchmarkGzFile(data)

        const result = await loadBenchmarkFromFile(filePath, benchmark.id, 'bench-dedup')

        expect(result.targetsLoaded).toBe(2)
        // Only 1 route created — the second target reuses it
        expect(result.routesCreated).toBe(1)

        // Only 1 Route record in DB
        const routes = await prisma.route.findMany()
        expect(routes).toHaveLength(1)

        // But 2 AcceptableRoute junction records
        const acceptableRoutes = await prisma.acceptableRoute.findMany()
        expect(acceptableRoutes).toHaveLength(2)
    })

    it('throws when acceptable route is missing contentHash or signature', async () => {
        const stock = await createStock({ name: 'bench-stock-missing-hash' })
        const benchmark = await createBenchmarkSet({ stockId: stock.id, name: 'bench-missing' })

        const route = makeLinearPythonRoute(1)

        const data = {
            name: 'bench-missing',
            targets: {
                't-001': {
                    id: 't-001',
                    smiles: route.target.smiles,
                    inchi_key: syntheticInchiKey(route.target.smiles),
                    acceptable_routes: [
                        {
                            target: route.target,
                            rank: 1,
                            // Missing content_hash and signature!
                        },
                    ],
                },
            },
        }
        const filePath = createTestBenchmarkGzFile(data)

        await expect(loadBenchmarkFromFile(filePath, benchmark.id, 'bench-missing')).rejects.toThrow(
            'Cannot ensure deduplication'
        )
    })

    it('uses file data for route length and isConvergent when present', async () => {
        const stock = await createStock({ name: 'bench-stock-props' })
        const benchmark = await createBenchmarkSet({ stockId: stock.id, name: 'bench-props' })

        const route = makeLinearPythonRoute(3)

        const data = {
            name: 'bench-props',
            targets: {
                't-001': {
                    id: 't-001',
                    smiles: route.target.smiles,
                    inchi_key: syntheticInchiKey(route.target.smiles),
                    acceptable_routes: [
                        {
                            target: route.target,
                            rank: 1,
                            content_hash: route.content_hash,
                            signature: route.signature,
                            length: 3,
                            has_convergent_reaction: false,
                        },
                    ],
                },
            },
        }
        const filePath = createTestBenchmarkGzFile(data)

        await loadBenchmarkFromFile(filePath, benchmark.id, 'bench-props')

        const dbRoute = await prisma.route.findUnique({ where: { signature: route.signature } })
        expect(dbRoute!.length).toBe(3)
        expect(dbRoute!.isConvergent).toBe(false)
    })

    it('computes route properties when not present in file data', async () => {
        const stock = await createStock({ name: 'bench-stock-compute' })
        const benchmark = await createBenchmarkSet({ stockId: stock.id, name: 'bench-compute' })

        const route = makeConvergentPythonRoute(2)

        const data = {
            name: 'bench-compute',
            targets: {
                't-001': {
                    id: 't-001',
                    smiles: route.target.smiles,
                    inchi_key: syntheticInchiKey(route.target.smiles),
                    acceptable_routes: [
                        {
                            target: route.target,
                            rank: 1,
                            content_hash: route.content_hash,
                            signature: route.signature,
                            // No length or has_convergent_reaction — must be computed
                        },
                    ],
                },
            },
        }
        const filePath = createTestBenchmarkGzFile(data)

        await loadBenchmarkFromFile(filePath, benchmark.id, 'bench-compute')

        const dbRoute = await prisma.route.findUnique({ where: { signature: route.signature } })
        expect(dbRoute!.length).toBe(2)
        expect(dbRoute!.isConvergent).toBe(true)
    })

    it('reuses molecules already in the database (e.g., from stock loading)', async () => {
        // First, load some molecules via stock loader
        const stockMolecules = [
            { smiles: carbonChainSmiles(1), inchikey: syntheticInchiKey('C') },
            { smiles: carbonChainSmiles(2), inchikey: syntheticInchiKey('CC') },
        ]
        const csvPath = createTestCsvFile(stockMolecules)
        const { stockId } = await loadStockFromFile(csvPath, 'cross-stock')

        const benchmark = await createBenchmarkSet({ stockId, name: 'bench-cross-mol' })

        // Create a route that uses molecule C (already in DB from stock)
        const route = makeLinearPythonRoute(1) // CC <- C (both molecules already exist)

        const data = {
            name: 'bench-cross-mol',
            targets: {
                't-001': {
                    id: 't-001',
                    smiles: route.target.smiles,
                    inchi_key: syntheticInchiKey(route.target.smiles),
                    acceptable_routes: [
                        {
                            target: route.target,
                            rank: 1,
                            content_hash: route.content_hash,
                            signature: route.signature,
                            length: 1,
                            has_convergent_reaction: false,
                        },
                    ],
                },
            },
        }
        const filePath = createTestBenchmarkGzFile(data)

        const result = await loadBenchmarkFromFile(filePath, benchmark.id, 'bench-cross-mol')

        // Target molecule may or may not be one of the stock molecules,
        // but the route tree molecules (C, CC) should be reused
        // The key test: no duplicate molecule records
        const allMolecules = await prisma.molecule.findMany()
        const inchikeys = allMolecules.map((m) => m.inchikey)
        const uniqueInchikeys = new Set(inchikeys)
        expect(inchikeys.length).toBe(uniqueInchikeys.size)

        // moleculesReused count from result should be non-zero since target molecule CC exists
        expect(result.moleculesReused).toBeGreaterThanOrEqual(1)
    })

    it('stores RouteNode tree with correct parent-child and leaf flags', async () => {
        const stock = await createStock({ name: 'bench-stock-tree' })
        const benchmark = await createBenchmarkSet({ stockId: stock.id, name: 'bench-tree' })

        const route = makeLinearPythonRoute(2) // CCC <- CC <- C

        const data = {
            name: 'bench-tree',
            targets: {
                't-001': {
                    id: 't-001',
                    smiles: route.target.smiles,
                    inchi_key: syntheticInchiKey(route.target.smiles),
                    acceptable_routes: [
                        {
                            target: route.target,
                            rank: 1,
                            content_hash: route.content_hash,
                            signature: route.signature,
                            length: 2,
                            has_convergent_reaction: false,
                        },
                    ],
                },
            },
        }
        const filePath = createTestBenchmarkGzFile(data)

        await loadBenchmarkFromFile(filePath, benchmark.id, 'bench-tree')

        const dbRoute = await prisma.route.findFirst()
        const nodes = await prisma.routeNode.findMany({
            where: { routeId: dbRoute!.id },
            include: { molecule: true },
        })

        // 3 nodes: root (CCC), intermediate (CC), leaf (C)
        expect(nodes).toHaveLength(3)

        // Find root (no parent)
        const root = nodes.find((n) => n.parentId === null)
        expect(root).toBeDefined()
        expect(root!.isLeaf).toBe(false)
        expect(root!.molecule.smiles).toBe(carbonChainSmiles(3))

        // Find leaf (no children)
        const leafNodes = nodes.filter((n) => n.isLeaf)
        expect(leafNodes).toHaveLength(1)
        expect(leafNodes[0].molecule.smiles).toBe(carbonChainSmiles(1))

        // Find intermediate
        const intermediate = nodes.find((n) => n.parentId === root!.id)
        expect(intermediate).toBeDefined()
        expect(intermediate!.isLeaf).toBe(false)

        // Leaf's parent should be intermediate
        expect(leafNodes[0].parentId).toBe(intermediate!.id)
    })

    it('sets BenchmarkTarget.routeLength and isConvergent from primary (index 0) route', async () => {
        const stock = await createStock({ name: 'bench-stock-primary' })
        const benchmark = await createBenchmarkSet({ stockId: stock.id, name: 'bench-primary' })

        const route = makeConvergentPythonRoute(2)

        const data = {
            name: 'bench-primary',
            targets: {
                't-001': {
                    id: 't-001',
                    smiles: route.target.smiles,
                    inchi_key: syntheticInchiKey(route.target.smiles),
                    acceptable_routes: [
                        {
                            target: route.target,
                            rank: 1,
                            content_hash: route.content_hash,
                            signature: route.signature,
                            length: 2,
                            has_convergent_reaction: true,
                        },
                    ],
                },
            },
        }
        const filePath = createTestBenchmarkGzFile(data)

        await loadBenchmarkFromFile(filePath, benchmark.id, 'bench-primary')

        const target = await prisma.benchmarkTarget.findFirst({
            where: { benchmarkSetId: benchmark.id },
        })
        expect(target!.routeLength).toBe(2)
        expect(target!.isConvergent).toBe(true)
    })

    it('stores multiple acceptable routes per target with correct routeIndex values', async () => {
        const stock = await createStock({ name: 'bench-stock-multi' })
        const benchmark = await createBenchmarkSet({ stockId: stock.id, name: 'bench-multi' })

        const route1 = makeLinearPythonRoute(1, 1) // Rank 1
        const route2 = makeLinearPythonRoute(3, 2) // Rank 2 — different topology

        const data = {
            name: 'bench-multi',
            targets: {
                't-001': {
                    id: 't-001',
                    smiles: carbonChainSmiles(10),
                    inchi_key: syntheticInchiKey(carbonChainSmiles(10)),
                    acceptable_routes: [
                        {
                            target: route1.target,
                            rank: 1,
                            content_hash: route1.content_hash,
                            signature: route1.signature,
                            length: 1,
                            has_convergent_reaction: false,
                        },
                        {
                            target: route2.target,
                            rank: 2,
                            content_hash: route2.content_hash,
                            signature: route2.signature,
                            length: 3,
                            has_convergent_reaction: false,
                        },
                    ],
                },
            },
        }
        const filePath = createTestBenchmarkGzFile(data)

        const result = await loadBenchmarkFromFile(filePath, benchmark.id, 'bench-multi')

        expect(result.routesCreated).toBe(2)

        const acceptableRoutes = await prisma.acceptableRoute.findMany({
            orderBy: { routeIndex: 'asc' },
        })
        expect(acceptableRoutes).toHaveLength(2)
        expect(acceptableRoutes[0].routeIndex).toBe(0)
        expect(acceptableRoutes[1].routeIndex).toBe(1)
    })

    it('throws on nonexistent file', async () => {
        const stock = await createStock({ name: 'bench-stock-ghost' })
        const benchmark = await createBenchmarkSet({ stockId: stock.id, name: 'bench-ghost' })

        await expect(
            loadBenchmarkFromFile('/nonexistent/benchmark.json.gz', benchmark.id, 'bench-ghost')
        ).rejects.toThrow('File not found')
    })

    it('sets hasAcceptableRoutes even when all route structures are reused from a prior load', async () => {
        // Regression test for the bug where routesCreated stayed 0 (all routes reused via try/catch)
        // but hasAcceptableRoutes was never set to true.
        const stock = await createStock({ name: 'bench-stock-reuse-flag' })

        const route = makeLinearPythonRoute(1) // CC <- C

        // First benchmark: loads the route for the first time, creating the Route record
        const benchmark1 = await createBenchmarkSet({ stockId: stock.id, name: 'bench-reuse-flag-1' })
        const data1 = {
            name: 'bench-reuse-flag-1',
            targets: {
                't-a': {
                    id: 't-a',
                    smiles: carbonChainSmiles(10),
                    inchi_key: syntheticInchiKey(carbonChainSmiles(10)),
                    acceptable_routes: [
                        {
                            target: route.target,
                            rank: 1,
                            content_hash: route.content_hash,
                            signature: route.signature,
                            length: 1,
                            has_convergent_reaction: false,
                        },
                    ],
                },
            },
        }
        const file1 = createTestBenchmarkGzFile(data1)
        const result1 = await loadBenchmarkFromFile(file1, benchmark1.id, 'bench-reuse-flag-1')
        expect(result1.routesCreated).toBe(1) // Route created fresh

        const bench1Updated = await prisma.benchmarkSet.findUnique({ where: { id: benchmark1.id } })
        expect(bench1Updated!.hasAcceptableRoutes).toBe(true)

        // Second benchmark: uses the SAME route signature — routesCreated will be 0 (reused)
        // but hasAcceptableRoutes must still be set to true.
        const benchmark2 = await createBenchmarkSet({ stockId: stock.id, name: 'bench-reuse-flag-2' })
        const data2 = {
            name: 'bench-reuse-flag-2',
            targets: {
                't-b': {
                    id: 't-b',
                    smiles: carbonChainSmiles(11),
                    inchi_key: syntheticInchiKey(carbonChainSmiles(11)),
                    acceptable_routes: [
                        {
                            target: route.target, // same route tree as above
                            rank: 1,
                            content_hash: route.content_hash,
                            signature: route.signature, // same signature → route will be reused
                            length: 1,
                            has_convergent_reaction: false,
                        },
                    ],
                },
            },
        }
        const file2 = createTestBenchmarkGzFile(data2)
        const result2 = await loadBenchmarkFromFile(file2, benchmark2.id, 'bench-reuse-flag-2')

        // routesCreated is 0 because the Route was already in DB
        expect(result2.routesCreated).toBe(0)

        // Still only 1 Route record in total (deduplicated)
        const totalRoutes = await prisma.route.count()
        expect(totalRoutes).toBe(1)

        // The key assertion: hasAcceptableRoutes must be true even though routesCreated == 0
        const bench2Updated = await prisma.benchmarkSet.findUnique({ where: { id: benchmark2.id } })
        expect(bench2Updated!.hasAcceptableRoutes).toBe(true)
    })
})
