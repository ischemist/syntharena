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
        length?: number
        has_convergent_reaction?: boolean
    }> = []
) {
    return {
        id,
        smiles,
        inchikey: syntheticInchiKey(smiles),
        acceptable_routes: acceptableRoutes,
    }
}

async function findAcceptableRouteForTarget(benchmarkSetId: string, targetId: string) {
    const target = await prisma.benchmarkTarget.findUnique({
        where: { benchmarkSetId_targetId: { benchmarkSetId, targetId } },
        include: {
            acceptableRoutes: {
                include: { route: true },
                orderBy: { routeIndex: 'asc' },
            },
        },
    })

    expect(target).not.toBeNull()
    expect(target!.acceptableRoutes).toHaveLength(1)
    return target!.acceptableRoutes[0]!.route
}

// ============================================================================
// loadBenchmarkFromFile — basic target loading
// ============================================================================

describe('loadBenchmarkFromFile', () => {
    it('rejects an acceptable route rooted at different target chemistry', async () => {
        const stock = await createStock({ name: 'bench-stock-root-binding' })
        const benchmark = await createBenchmarkSet({ stockId: stock.id, name: 'bench-root-binding' })
        const route = makeLinearPythonRoute(1)
        const filePath = createTestBenchmarkGzFile({
            name: benchmark.name,
            targets: {
                't-001': makeBenchmarkTarget('t-001', 'CCC', [route]),
            },
        })

        await expect(loadBenchmarkFromFile(filePath, benchmark.id, benchmark.name)).rejects.toThrow(
            'Acceptable route 0 root differs from benchmark target t-001'
        )
        await expect(prisma.benchmarkTarget.count({ where: { benchmarkSetId: benchmark.id } })).resolves.toBe(0)
    })

    it('rolls back a newly created route when route-tree persistence fails', async () => {
        const stock = await createStock({ name: 'bench-stock-route-rollback' })
        const benchmark = await createBenchmarkSet({ stockId: stock.id, name: 'bench-route-rollback' })
        const route = makeLinearPythonRoute(1)
        const filePath = createTestBenchmarkGzFile({
            name: benchmark.name,
            targets: {
                't-001': makeBenchmarkTarget('t-001', route.target.smiles, [route]),
            },
        })
        await prisma.$executeRawUnsafe(`
            CREATE TRIGGER reject_route_nodes
            BEFORE INSERT ON RouteNode
            BEGIN
                SELECT RAISE(ABORT, 'injected route-node failure');
            END
        `)

        try {
            await expect(loadBenchmarkFromFile(filePath, benchmark.id, benchmark.name)).rejects.toThrow()
        } finally {
            await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS reject_route_nodes')
        }

        await expect(prisma.route.count()).resolves.toBe(0)
        await expect(prisma.routeNode.count()).resolves.toBe(0)
        await expect(prisma.acceptableRoute.count()).resolves.toBe(0)
        await expect(prisma.benchmarkTarget.count({ where: { benchmarkSetId: benchmark.id } })).resolves.toBe(0)
    })

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
                    inchikey: syntheticInchiKey(route.target.smiles),
                    acceptable_routes: [
                        {
                            target: route.target,
                            rank: 1,
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
        expect(routes[0].signature).toBeTruthy()
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

        // Two target records for the same exact chemistry share one acceptable route.
        const targetSmiles = route.target.smiles

        const data = {
            name: 'bench-dedup',
            targets: {
                't-001': {
                    id: 't-001',
                    smiles: targetSmiles,
                    inchikey: route.target.inchikey,
                    acceptable_routes: [
                        {
                            target: route.target,
                            rank: 1,
                            length: 1,
                            has_convergent_reaction: false,
                        },
                    ],
                },
                't-002': {
                    id: 't-002',
                    smiles: targetSmiles,
                    inchikey: route.target.inchikey,
                    acceptable_routes: [
                        {
                            target: route.target,
                            rank: 1,
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

    it('does not merge identical topology with different producer provenance', async () => {
        const stock = await createStock({ name: 'bench-stock-provenance' })
        const benchmark = await createBenchmarkSet({ stockId: stock.id, name: 'bench-provenance' })
        const first = makeLinearPythonRoute(1)
        const second = makeLinearPythonRoute(1)
        first.target.product_of!.template = 'template-a'
        first.target.product_of!.mapped_reaction_smiles = '[C:1]>>[C:1]'
        second.target.product_of!.template = 'template-b'
        second.target.product_of!.mapped_reaction_smiles = '[CH3:1]>>[CH3:1]'
        const filePath = createTestBenchmarkGzFile({
            name: 'bench-provenance',
            targets: {
                't-001': makeBenchmarkTarget('t-001', 'CC', [first]),
                't-002': makeBenchmarkTarget('t-002', 'CC', [second]),
            },
        })

        await loadBenchmarkFromFile(filePath, benchmark.id, benchmark.name)

        const routes = await prisma.route.findMany({ include: { nodes: true } })
        expect(routes).toHaveLength(2)
        expect(new Set(routes.map((route) => route.signature))).toHaveLength(1)
        expect(new Set(routes.map((route) => route.contentHash))).toHaveLength(2)
        expect(new Set(routes.flatMap((route) => route.nodes.map((node) => node.template).filter(Boolean)))).toEqual(
            new Set(['template-a', 'template-b'])
        )
    })

    it('computes route signatures from v0.7 route payloads', async () => {
        const stock = await createStock({ name: 'bench-stock-missing-hash' })
        const benchmark = await createBenchmarkSet({ stockId: stock.id, name: 'bench-missing' })

        const route = makeLinearPythonRoute(1)

        const data = {
            name: 'bench-missing',
            targets: {
                't-001': {
                    id: 't-001',
                    smiles: route.target.smiles,
                    inchikey: syntheticInchiKey(route.target.smiles),
                    acceptable_routes: [
                        {
                            target: route.target,
                            rank: 1,
                            // Signature is computed from the route tree.
                        },
                    ],
                },
            },
        }
        const filePath = createTestBenchmarkGzFile(data)

        const result = await loadBenchmarkFromFile(filePath, benchmark.id, 'bench-missing')

        expect(result.routesCreated).toBe(1)
        const dbRoute = await findAcceptableRouteForTarget(benchmark.id, 't-001')
        expect(dbRoute.signature).toBeTruthy()
        expect(dbRoute.length).toBe(1)
        expect(dbRoute.isConvergent).toBe(false)
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
                    inchikey: syntheticInchiKey(route.target.smiles),
                    acceptable_routes: [
                        {
                            target: route.target,
                            rank: 1,
                            length: 3,
                            has_convergent_reaction: false,
                        },
                    ],
                },
            },
        }
        const filePath = createTestBenchmarkGzFile(data)

        await loadBenchmarkFromFile(filePath, benchmark.id, 'bench-props')

        const dbRoute = await findAcceptableRouteForTarget(benchmark.id, 't-001')
        expect(dbRoute.length).toBe(3)
        expect(dbRoute.isConvergent).toBe(false)
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
                    inchikey: syntheticInchiKey(route.target.smiles),
                    acceptable_routes: [
                        {
                            target: route.target,
                            rank: 1,
                            // No length or has_convergent_reaction — must be computed
                        },
                    ],
                },
            },
        }
        const filePath = createTestBenchmarkGzFile(data)

        await loadBenchmarkFromFile(filePath, benchmark.id, 'bench-compute')

        const dbRoute = await findAcceptableRouteForTarget(benchmark.id, 't-001')
        expect(dbRoute.length).toBe(2)
        expect(dbRoute.isConvergent).toBe(true)
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
                    inchikey: syntheticInchiKey(route.target.smiles),
                    acceptable_routes: [
                        {
                            target: route.target,
                            rank: 1,
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
                    inchikey: syntheticInchiKey(route.target.smiles),
                    acceptable_routes: [
                        {
                            target: route.target,
                            rank: 1,
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
                    inchikey: syntheticInchiKey(route.target.smiles),
                    acceptable_routes: [
                        {
                            target: route.target,
                            rank: 1,
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
        route2.target.smiles = route1.target.smiles
        route2.target.inchikey = route1.target.inchikey

        const data = {
            name: 'bench-multi',
            targets: {
                't-001': {
                    id: 't-001',
                    smiles: route1.target.smiles,
                    inchikey: route1.target.inchikey,
                    acceptable_routes: [
                        {
                            target: route1.target,
                            rank: 1,
                            length: 1,
                            has_convergent_reaction: false,
                        },
                        {
                            target: route2.target,
                            rank: 2,
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
                    smiles: route.target.smiles,
                    inchikey: route.target.inchikey,
                    acceptable_routes: [
                        {
                            target: route.target,
                            rank: 1,
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

        // Second benchmark: uses the same route tree — routesCreated will be 0 (reused)
        // but hasAcceptableRoutes must still be set to true.
        const benchmark2 = await createBenchmarkSet({ stockId: stock.id, name: 'bench-reuse-flag-2' })
        const data2 = {
            name: 'bench-reuse-flag-2',
            targets: {
                't-b': {
                    id: 't-b',
                    smiles: route.target.smiles,
                    inchikey: route.target.inchikey,
                    acceptable_routes: [
                        {
                            target: route.target, // same route tree as above
                            rank: 1,
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
