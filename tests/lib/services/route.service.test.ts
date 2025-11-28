/**
 * Tests for route.service.ts
 *
 * Focus: Testing the actual exported service functions
 * - getRouteById: Retrieve route by ID
 * - getRouteTreeData: Complete route tree for visualization
 * - getRoutesByTarget: All routes for a target
 * - getRouteTreeForVisualization: Simplified tree structure
 * - loadBenchmarkFromFile: Loading benchmarks from files
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import * as zlib from 'zlib'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import prisma from '@/lib/db'
import {
    getRouteById,
    getRoutesByTarget,
    getRouteTreeData,
    getRouteTreeForVisualization,
    loadBenchmarkFromFile,
} from '@/lib/services/route.service'

import {
    complexRoutePython,
    convergentRoutePython,
    linearChainPython,
    singleMoleculePython,
} from './route.service.fixtures'

// Type definitions for Python route structures
interface PythonReactionStep {
    reactants: PythonMolecule[]
    mapped_smiles?: string | null
    template?: string | null
    reagents?: string[] | null
    solvents?: string[] | null
    metadata?: Record<string, unknown>
    is_convergent?: boolean
}

interface PythonMolecule {
    smiles: string
    inchikey: string
    synthesis_step: PythonReactionStep | null
    metadata?: Record<string, unknown>
    is_leaf?: boolean
}

/**
 * Helper to store a Python route tree in the database
 * This simulates what the service does internally
 */
const storeRouteInDatabase = async (pythonRoute: PythonMolecule, routeId: string) => {
    const moleculesMap = new Map<string, { smiles: string; inchikey: string }>()
    const nodesData: Array<{
        tempId: string
        moleculeInchikey: string
        parentTempId: string | null
        isLeaf: boolean
        template: string | null
    }> = []
    let tempIdCounter = 0

    // Collect all molecules and nodes
    const collectData = (mol: PythonMolecule, parentTempId: string | null): string => {
        if (!moleculesMap.has(mol.inchikey)) {
            moleculesMap.set(mol.inchikey, {
                smiles: mol.smiles,
                inchikey: mol.inchikey,
            })
        }

        const tempId = `temp-${tempIdCounter++}`
        const isLeaf = !mol.synthesis_step

        nodesData.push({
            tempId,
            moleculeInchikey: mol.inchikey,
            parentTempId,
            isLeaf,
            template: mol.synthesis_step?.template || null,
        })

        if (mol.synthesis_step?.reactants) {
            for (const reactant of mol.synthesis_step.reactants) {
                collectData(reactant, tempId)
            }
        }

        return tempId
    }

    collectData(pythonRoute, null)

    // Create molecules
    const inchikeyToId = new Map<string, string>()
    for (const [inchikey, molData] of moleculesMap) {
        const mol = await prisma.molecule.upsert({
            where: { inchikey },
            update: {},
            create: molData,
        })
        inchikeyToId.set(inchikey, mol.id)
    }

    // Create nodes in order (parent before children)
    const tempIdToRealId = new Map<string, string>()
    const nodesByParent = new Map<string | null, typeof nodesData>()

    for (const node of nodesData) {
        if (!nodesByParent.has(node.parentTempId)) {
            nodesByParent.set(node.parentTempId, [])
        }
        nodesByParent.get(node.parentTempId)!.push(node)
    }

    const queue = nodesByParent.get(null) || []
    while (queue.length > 0) {
        const currentBatch = [...queue]
        queue.length = 0

        for (const nodeData of currentBatch) {
            const moleculeId = inchikeyToId.get(nodeData.moleculeInchikey)!
            const parentId = nodeData.parentTempId ? tempIdToRealId.get(nodeData.parentTempId) || null : null

            const createdNode = await prisma.routeNode.create({
                data: {
                    routeId,
                    moleculeId,
                    parentId,
                    isLeaf: nodeData.isLeaf,
                    template: nodeData.template,
                    metadata: null,
                },
            })

            tempIdToRealId.set(nodeData.tempId, createdNode.id)

            const children = nodesByParent.get(nodeData.tempId) || []
            queue.push(...children)
        }
    }
}

/**
 * Helper to create a complete route setup
 */
const createCompleteRoute = async (pythonRoute: PythonMolecule) => {
    const benchmark = await prisma.benchmarkSet.create({
        data: {
            name: `test-benchmark-${Date.now()}-${Math.random()}`,
        },
    })

    const targetMol = await prisma.molecule.upsert({
        where: { inchikey: pythonRoute.inchikey },
        update: {},
        create: {
            smiles: pythonRoute.smiles,
            inchikey: pythonRoute.inchikey,
        },
    })

    const benchmarkTarget = await prisma.benchmarkTarget.create({
        data: {
            benchmarkSetId: benchmark.id,
            targetId: `test-target-${Date.now()}-${Math.random()}`,
            moleculeId: targetMol.id,
        },
    })

    const route = await prisma.route.create({
        data: {
            signature: 'test-signature',
            contentHash: 'test-content-hash',
            length: 0,
            isConvergent: false,
        },
    })

    await storeRouteInDatabase(pythonRoute, route.id)

    return { benchmark, targetMol, benchmarkTarget, route }
}

describe('route.service - Service Function Tests', () => {
    beforeEach(async () => {
        await prisma.$transaction([
            prisma.routeNode.deleteMany({}),
            prisma.predictionRoute.deleteMany({}),
            prisma.route.deleteMany({}),
            prisma.benchmarkTarget.deleteMany({}),
            prisma.predictionRun.deleteMany({}),
            prisma.benchmarkSet.deleteMany({}),
            prisma.modelInstance.deleteMany({}),
            prisma.algorithm.deleteMany({}),
            prisma.stockItem.deleteMany({}),
            prisma.molecule.deleteMany({}),
        ])
    })

    afterEach(async () => {
        await prisma.$transaction([
            prisma.routeNode.deleteMany({}),
            prisma.predictionRoute.deleteMany({}),
            prisma.route.deleteMany({}),
            prisma.benchmarkTarget.deleteMany({}),
            prisma.predictionRun.deleteMany({}),
            prisma.benchmarkSet.deleteMany({}),
            prisma.modelInstance.deleteMany({}),
            prisma.algorithm.deleteMany({}),
            prisma.stockItem.deleteMany({}),
            prisma.molecule.deleteMany({}),
        ])
    })

    describe('getRouteById', () => {
        it('should retrieve a route by ID', async () => {
            const { route } = await createCompleteRoute(singleMoleculePython)

            const result = await getRouteById(route.id)

            expect(result).toBeDefined()
            expect(result.id).toBe(route.id)
            expect(result.contentHash).toBe('test-content-hash')
        })

        it('should throw error when route not found', async () => {
            await expect(getRouteById('non-existent-id')).rejects.toThrow('Route not found')
        })

        it('should return all route properties', async () => {
            const { route } = await createCompleteRoute(linearChainPython)

            const result = await getRouteById(route.id)

            expect(result).toMatchObject({
                id: route.id,
                contentHash: 'test-content-hash',
                signature: 'test-signature',
                length: 0,
                isConvergent: false,
            })
        })
    })

    describe('getRouteTreeData', () => {
        it('should retrieve complete route tree with target and root node', async () => {
            const { route, benchmarkTarget } = await createCompleteRoute(singleMoleculePython)

            const result = await getRouteTreeData(route.id, undefined, benchmarkTarget.id)

            expect(result).toBeDefined()
            expect(result.route).toBeDefined()
            expect(result.target).toBeDefined()
            expect(result.rootNode).toBeDefined()
        })

        it('should include molecule data in tree nodes', async () => {
            const { route, benchmarkTarget } = await createCompleteRoute(singleMoleculePython)

            const result = await getRouteTreeData(route.id, undefined, benchmarkTarget.id)

            expect(result.rootNode.molecule).toBeDefined()
            expect(result.rootNode.molecule.smiles).toBe(singleMoleculePython.smiles)
            expect(result.rootNode.molecule.inchikey).toBe(singleMoleculePython.inchikey)
        })

        it('should build complete tree structure for linear chain', async () => {
            const { route, benchmarkTarget } = await createCompleteRoute(linearChainPython)

            const result = await getRouteTreeData(route.id, undefined, benchmarkTarget.id)

            expect(result.rootNode.children.length).toBe(1)
            expect(result.rootNode.children[0].children.length).toBe(1)
            expect(result.rootNode.children[0].children[0].isLeaf).toBe(true)
        })

        it('should build convergent tree structure', async () => {
            const { route, benchmarkTarget } = await createCompleteRoute(convergentRoutePython)

            const result = await getRouteTreeData(route.id, undefined, benchmarkTarget.id)

            expect(result.rootNode.children.length).toBe(2)
            expect(result.rootNode.isLeaf).toBe(false)
        })

        it('should include target with ground truth flag', async () => {
            const { route, benchmarkTarget } = await createCompleteRoute(singleMoleculePython)

            await prisma.benchmarkTarget.update({
                where: { id: benchmarkTarget.id },
                data: { groundTruthRouteId: route.id },
            })

            const result = await getRouteTreeData(route.id, undefined, benchmarkTarget.id)

            expect(result.target.hasGroundTruth).toBe(true)
            expect(result.target.groundTruthRouteId).toBe(route.id)
        })

        it('should throw error when route not found', async () => {
            await expect(getRouteTreeData('non-existent-id', undefined, 'fake-target-id')).rejects.toThrow(
                'Route not found'
            )
        })

        it('should handle complex multi-level routes', async () => {
            const { route, benchmarkTarget } = await createCompleteRoute(complexRoutePython)

            const result = await getRouteTreeData(route.id, undefined, benchmarkTarget.id)

            expect(result.rootNode).toBeDefined()
            expect(result.rootNode.children.length).toBeGreaterThan(0)

            // Verify the tree has multiple levels
            const countNodes = (node: typeof result.rootNode): number => {
                return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0)
            }

            const totalNodes = countNodes(result.rootNode)
            expect(totalNodes).toBeGreaterThan(5)
        })
    })

    describe('getRoutesByTarget', () => {
        it('should return empty array when no routes exist', async () => {
            const benchmark = await prisma.benchmarkSet.create({
                data: { name: 'test-benchmark' },
            })

            const mol = await prisma.molecule.create({
                data: {
                    smiles: 'C',
                    inchikey: 'TEST-INCHIKEY',
                },
            })

            const target = await prisma.benchmarkTarget.create({
                data: {
                    benchmarkSetId: benchmark.id,
                    targetId: 'test-target',
                    moleculeId: mol.id,
                },
            })

            const routes = await getRoutesByTarget(target.id)

            expect(routes).toEqual([])
        })

        it('should return all routes for a target', async () => {
            const { benchmarkTarget, benchmark, route } = await createCompleteRoute(singleMoleculePython)

            // Create second route
            const route2 = await prisma.route.create({
                data: {
                    signature: 'test-signature-2',
                    contentHash: 'test2',
                    length: 0,
                    isConvergent: false,
                },
            })

            // Create test algorithm and model instance
            const algorithm = await prisma.algorithm.create({
                data: { name: 'test-algo' },
            })

            const modelInstance = await prisma.modelInstance.create({
                data: {
                    algorithmId: algorithm.id,
                    name: 'test-model',
                },
            })

            // Create PredictionRun
            const predictionRun = await prisma.predictionRun.create({
                data: {
                    modelInstanceId: modelInstance.id,
                    benchmarkSetId: benchmark.id,
                    totalRoutes: 2,
                },
            })

            await prisma.predictionRoute.createMany({
                data: [
                    {
                        routeId: route.id,
                        predictionRunId: predictionRun.id,
                        targetId: benchmarkTarget.id,
                        rank: 1,
                    },
                    {
                        routeId: route2.id,
                        predictionRunId: predictionRun.id,
                        targetId: benchmarkTarget.id,
                        rank: 2,
                    },
                ],
            })

            const routes = await getRoutesByTarget(benchmarkTarget.id)

            expect(routes).toHaveLength(2)
        })

        it('should return routes ordered by rank', async () => {
            const { benchmarkTarget, benchmark, route } = await createCompleteRoute(singleMoleculePython)

            const route2 = await prisma.route.create({
                data: {
                    signature: 'test-signature-2',
                    contentHash: 'test2',
                    length: 0,
                    isConvergent: false,
                },
            })

            const route3 = await prisma.route.create({
                data: {
                    signature: 'test-signature-3',
                    contentHash: 'test3',
                    length: 0,
                    isConvergent: false,
                },
            })

            // Create test algorithm and model instance
            const algorithm = await prisma.algorithm.create({
                data: { name: 'test-algo-rank' },
            })

            const modelInstance = await prisma.modelInstance.create({
                data: {
                    algorithmId: algorithm.id,
                    name: 'test-model-rank',
                },
            })

            const predictionRun = await prisma.predictionRun.create({
                data: {
                    modelInstanceId: modelInstance.id,
                    benchmarkSetId: benchmark.id,
                    totalRoutes: 3,
                },
            })

            await prisma.predictionRoute.createMany({
                data: [
                    {
                        routeId: route.id,
                        predictionRunId: predictionRun.id,
                        targetId: benchmarkTarget.id,
                        rank: 1,
                    },
                    {
                        routeId: route3.id,
                        predictionRunId: predictionRun.id,
                        targetId: benchmarkTarget.id,
                        rank: 3,
                    },
                    {
                        routeId: route2.id,
                        predictionRunId: predictionRun.id,
                        targetId: benchmarkTarget.id,
                        rank: 2,
                    },
                ],
            })

            const routes = await getRoutesByTarget(benchmarkTarget.id)

            expect(routes).toHaveLength(3)
            expect(routes[0].predictionRoute.rank).toBe(1)
            expect(routes[1].predictionRoute.rank).toBe(2)
            expect(routes[2].predictionRoute.rank).toBe(3)
        })
    })

    describe('getRouteTreeForVisualization', () => {
        it('should return simplified tree with just SMILES', async () => {
            const { route } = await createCompleteRoute(singleMoleculePython)

            const result = await getRouteTreeForVisualization(route.id)

            expect(result).toBeDefined()
            expect(result.smiles).toBe(singleMoleculePython.smiles)
            expect(result.children).toBeUndefined()
        })

        it('should include children for non-leaf nodes', async () => {
            const { route } = await createCompleteRoute(linearChainPython)

            const result = await getRouteTreeForVisualization(route.id)

            expect(result.smiles).toBe(linearChainPython.smiles)
            expect(result.children).toBeDefined()
            expect(result.children).toHaveLength(1)
        })

        it('should recursively transform entire tree', async () => {
            const { route } = await createCompleteRoute(convergentRoutePython)

            const result = await getRouteTreeForVisualization(route.id)

            expect(result.children).toBeDefined()
            expect(result.children).toHaveLength(2)

            // Check that children have SMILES
            for (const child of result.children!) {
                expect(child.smiles).toBeDefined()
                expect(typeof child.smiles).toBe('string')
            }
        })

        it('should throw error when route not found', async () => {
            await expect(getRouteTreeForVisualization('non-existent-id')).rejects.toThrow('Route not found')
        })

        it('should handle complex multi-level trees', async () => {
            const { route } = await createCompleteRoute(complexRoutePython)

            const result = await getRouteTreeForVisualization(route.id)

            expect(result.smiles).toBe(complexRoutePython.smiles)
            expect(result.children).toBeDefined()

            // Count all nodes in the visualization tree
            const countNodes = (node: typeof result): number => {
                return 1 + (node.children?.reduce((sum, child) => sum + countNodes(child), 0) || 0)
            }

            const totalNodes = countNodes(result)
            expect(totalNodes).toBeGreaterThan(5)
        })
    })

    describe('loadBenchmarkFromFile', () => {
        const createTestBenchmarkFile = async (
            filename: string,
            data: {
                name: string
                targets: Record<
                    string,
                    {
                        smiles: string
                        ground_truth?: {
                            target: PythonMolecule
                            rank: number
                        } | null
                        route_length?: number | null
                        is_convergent?: boolean | null
                    }
                >
            }
        ): Promise<string> => {
            const tmpDir = path.join(__dirname, '..', '..', 'tmp')
            await fs.mkdir(tmpDir, { recursive: true })

            const filePath = path.join(tmpDir, filename)
            const jsonString = JSON.stringify(data)
            const compressed = zlib.gzipSync(Buffer.from(jsonString))
            await fs.writeFile(filePath, compressed)

            return filePath
        }

        const cleanupTestFile = async (filePath: string) => {
            try {
                await fs.unlink(filePath)
            } catch {
                // ignore if file doesn't exist
            }
        }

        it('should load benchmark from file with single target', async () => {
            const benchmark = await prisma.benchmarkSet.create({
                data: { name: 'test-load-benchmark' },
            })

            const benchmarkData = {
                name: 'Test Benchmark',
                targets: {
                    'target-1': {
                        smiles: singleMoleculePython.smiles,
                        ground_truth: {
                            target: singleMoleculePython,
                            rank: 1,
                        },
                        route_length: 0,
                        is_convergent: false,
                    },
                },
            }

            const filePath = await createTestBenchmarkFile('test-benchmark.json.gz', benchmarkData)

            try {
                const result = await loadBenchmarkFromFile(filePath, benchmark.id, 'Test Benchmark')

                expect(result.benchmarkId).toBe(benchmark.id)
                expect(result.benchmarkName).toBe('Test Benchmark')
                expect(result.targetsLoaded).toBe(1)
                expect(result.routesCreated).toBe(1)
                expect(result.moleculesCreated).toBeGreaterThan(0)
            } finally {
                await cleanupTestFile(filePath)
            }
        })

        it('should throw error when file does not exist', async () => {
            const benchmark = await prisma.benchmarkSet.create({
                data: { name: 'test-benchmark' },
            })

            await expect(loadBenchmarkFromFile('/non/existent/file.json.gz', benchmark.id, 'Test')).rejects.toThrow(
                'File not found'
            )
        })

        it('should load multiple targets from file', async () => {
            const benchmark = await prisma.benchmarkSet.create({
                data: { name: 'test-multi-benchmark' },
            })

            const benchmarkData = {
                name: 'Multi Target Benchmark',
                targets: {
                    'target-1': {
                        smiles: singleMoleculePython.smiles,
                        ground_truth: {
                            target: singleMoleculePython,
                            rank: 1,
                            content_hash: `hash-${Date.now()}-1`, // Unique hash
                            signature: null,
                        },
                    },
                    'target-2': {
                        smiles: linearChainPython.smiles,
                        ground_truth: {
                            target: linearChainPython,
                            rank: 1,
                            content_hash: `hash-${Date.now()}-2`, // Unique hash
                            signature: null,
                        },
                    },
                },
            }

            const filePath = await createTestBenchmarkFile('test-multi.json.gz', benchmarkData)

            try {
                const result = await loadBenchmarkFromFile(filePath, benchmark.id, 'Multi Target Benchmark')

                expect(result.targetsLoaded).toBe(2)
                expect(result.routesCreated).toBe(2)
            } finally {
                await cleanupTestFile(filePath)
            }
        })

        it('should compute route properties correctly', async () => {
            const benchmark = await prisma.benchmarkSet.create({
                data: { name: 'test-properties' },
            })

            const benchmarkData = {
                name: 'Properties Test',
                targets: {
                    'target-1': {
                        smiles: linearChainPython.smiles,
                        ground_truth: {
                            target: linearChainPython,
                            rank: 1,
                        },
                    },
                },
            }

            const filePath = await createTestBenchmarkFile('test-properties.json.gz', benchmarkData)

            try {
                await loadBenchmarkFromFile(filePath, benchmark.id, 'Properties Test')

                const target = await prisma.benchmarkTarget.findFirst({
                    where: { benchmarkSetId: benchmark.id },
                })

                expect(target).toBeDefined()
                expect(target!.routeLength).toBe(2) // Linear chain has length 2
                expect(target!.isConvergent).toBe(false)

                const route = await prisma.route.findUnique({
                    where: { id: target!.groundTruthRouteId! },
                })
                expect(route).toBeDefined()
                expect(route!.length).toBe(2)
                expect(route!.isConvergent).toBe(false)
            } finally {
                await cleanupTestFile(filePath)
            }
        })

        it('should handle targets without ground truth', async () => {
            const benchmark = await prisma.benchmarkSet.create({
                data: { name: 'test-no-ground-truth' },
            })

            const benchmarkData = {
                name: 'No Ground Truth Test',
                targets: {
                    'target-1': {
                        smiles: singleMoleculePython.smiles,
                    },
                },
            }

            const filePath = await createTestBenchmarkFile('test-no-gt.json.gz', benchmarkData)

            try {
                const result = await loadBenchmarkFromFile(filePath, benchmark.id, 'No Ground Truth Test')

                expect(result.targetsLoaded).toBe(1)
                expect(result.routesCreated).toBe(0)

                const target = await prisma.benchmarkTarget.findFirst({
                    where: { benchmarkSetId: benchmark.id },
                })

                expect(target).toBeDefined()
                expect(target!.groundTruthRouteId).toBeNull()
            } finally {
                await cleanupTestFile(filePath)
            }
        })

        it('should reuse existing molecules', async () => {
            // Pre-create a molecule
            await prisma.molecule.create({
                data: {
                    smiles: singleMoleculePython.smiles,
                    inchikey: singleMoleculePython.inchikey,
                },
            })

            const benchmark = await prisma.benchmarkSet.create({
                data: { name: 'test-reuse' },
            })

            const benchmarkData = {
                name: 'Reuse Test',
                targets: {
                    'target-1': {
                        smiles: singleMoleculePython.smiles,
                        ground_truth: {
                            target: singleMoleculePython,
                            rank: 1,
                        },
                    },
                },
            }

            const filePath = await createTestBenchmarkFile('test-reuse.json.gz', benchmarkData)

            try {
                const result = await loadBenchmarkFromFile(filePath, benchmark.id, 'Reuse Test')

                expect(result.moleculesReused).toBeGreaterThan(0)
            } finally {
                await cleanupTestFile(filePath)
            }
        })
    })
})
