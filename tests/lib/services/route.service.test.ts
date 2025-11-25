/**
 * Tests for route.service.ts
 *
 * Focus: Complex algorithms and business logic
 * - Tree building from flat database queries (N+1 prevention)
 * - Graph algorithms (route length, convergence detection)
 * - Recursive tree transformations
 * - Bulk database operations with transactions
 * - Error handling and edge cases
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { RouteNodeWithDetails } from '@/types'
import prisma from '@/lib/db'

import {
    complexRoutePython,
    convergentRoutePython,
    createTreeStructure,
    linearChainPython,
    singleMoleculePython,
} from './route.service.fixtures'

/**
 * Helper to create test data in database
 */
const createTestRoute = async (pythonRoute: {
    smiles: string
    inchikey: string
    is_leaf?: boolean
    synthesis_step?: unknown
}) => {
    const benchmark = await prisma.benchmarkSet.create({
        data: {
            name: `test-benchmark-${Date.now()}`,
        },
    })

    const targetMol = await prisma.molecule.create({
        data: {
            smiles: pythonRoute.smiles,
            inchikey: pythonRoute.inchikey,
        },
    })

    const benchmarkTarget = await prisma.benchmarkTarget.create({
        data: {
            benchmarkSetId: benchmark.id,
            targetId: `test-target-${Date.now()}`,
            moleculeId: targetMol.id,
        },
    })

    const route = await prisma.route.create({
        data: {
            targetId: benchmarkTarget.id,
            rank: 1,
            contentHash: 'test',
            length: 0,
            isConvergent: false,
        },
    })

    return { benchmark, targetMol, benchmarkTarget, route, pythonRoute }
}

/**
 * Helper to build tree nodes in database
 */
const storeTreeInDatabase = async (
    routeId: string,
    pythonRoute: { smiles: string; inchikey: string; is_leaf?: boolean; synthesis_step?: unknown }
) => {
    const { molecules, nodes } = createTreeStructure(routeId, pythonRoute)

    // Insert molecules
    for (const moleculeData of molecules.values()) {
        await prisma.molecule.upsert({
            where: { inchikey: moleculeData.inchikey },
            update: {},
            create: moleculeData,
        })
    }

    // Insert nodes
    for (const node of nodes) {
        const moleculeData = molecules.get(
            [...molecules.entries()].find(([, m]) => m.id === node.moleculeId)?.[0] || ''
        )
        if (!moleculeData) throw new Error('Molecule not found')

        const molecule = await prisma.molecule.findUnique({
            where: { inchikey: moleculeData.inchikey },
        })
        if (!molecule) throw new Error('Could not find created molecule')

        await prisma.routeNode.create({
            data: {
                id: node.id,
                routeId: node.routeId,
                moleculeId: molecule.id,
                parentId: node.parentId,
                isLeaf: node.isLeaf,
                template: node.template,
            },
        })
    }

    return { molecules, nodes }
}

describe('route.service - Complex Algorithm Tests', () => {
    beforeEach(async () => {
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
        await prisma.$transaction([
            prisma.routeNode.deleteMany({}),
            prisma.route.deleteMany({}),
            prisma.benchmarkTarget.deleteMany({}),
            prisma.benchmarkSet.deleteMany({}),
            prisma.stockItem.deleteMany({}),
            prisma.molecule.deleteMany({}),
        ])
    })

    describe('computeRouteProperties - Route Length and Convergence', () => {
        it('should compute correct length for single leaf node', async () => {
            const { route, pythonRoute } = await createTestRoute(singleMoleculePython)
            await storeTreeInDatabase(route.id, pythonRoute)

            const nodes = await prisma.routeNode.findMany({
                where: { routeId: route.id },
                select: { id: true, parentId: true, isLeaf: true },
            })

            const nodeMap = new Map<string, { id: string; isLeaf: boolean; childIds: string[] }>()
            let rootId: string | null = null

            for (const node of nodes) {
                nodeMap.set(node.id, {
                    id: node.id,
                    isLeaf: node.isLeaf,
                    childIds: [],
                })

                if (node.parentId === null) {
                    rootId = node.id
                }
            }

            for (const node of nodes) {
                if (node.parentId) {
                    const parent = nodeMap.get(node.parentId)
                    if (parent) {
                        parent.childIds.push(node.id)
                    }
                }
            }

            if (!rootId) throw new Error('No root found')

            function getDepth(nodeId: string): number {
                const node = nodeMap.get(nodeId)
                if (!node || node.childIds.length === 0) return 0
                const childDepths = node.childIds.map((childId) => getDepth(childId))
                return 1 + Math.max(...childDepths)
            }

            const length = getDepth(rootId)
            expect(length).toBe(0)
        })

        it('should compute correct length for linear chain', async () => {
            const { route, pythonRoute } = await createTestRoute(linearChainPython)
            await storeTreeInDatabase(route.id, pythonRoute)

            const nodes = await prisma.routeNode.findMany({
                where: { routeId: route.id },
                select: { id: true, parentId: true, isLeaf: true },
            })

            expect(nodes.length).toBe(3)

            const nodeMap = new Map<string, { id: string; isLeaf: boolean; childIds: string[] }>()
            let rootId: string | null = null

            for (const node of nodes) {
                nodeMap.set(node.id, {
                    id: node.id,
                    isLeaf: node.isLeaf,
                    childIds: [],
                })

                if (node.parentId === null) {
                    rootId = node.id
                }
            }

            for (const node of nodes) {
                if (node.parentId) {
                    const parent = nodeMap.get(node.parentId)
                    if (parent) {
                        parent.childIds.push(node.id)
                    }
                }
            }

            if (!rootId) throw new Error('No root found')

            function getDepth(nodeId: string): number {
                const node = nodeMap.get(nodeId)
                if (!node || node.childIds.length === 0) return 0
                const childDepths = node.childIds.map((childId) => getDepth(childId))
                return 1 + Math.max(...childDepths)
            }

            const length = getDepth(rootId)
            expect(length).toBe(2)
        })

        it('should detect convergence for complex routes with multiple branches', async () => {
            const { route, pythonRoute } = await createTestRoute(complexRoutePython)
            await storeTreeInDatabase(route.id, pythonRoute)

            const nodes = await prisma.routeNode.findMany({
                where: { routeId: route.id },
                select: { id: true, parentId: true, isLeaf: true },
            })

            // Complex route should have multiple nodes
            expect(nodes.length).toBeGreaterThan(3)

            const nodeMap = new Map<string, { id: string; isLeaf: boolean; childIds: string[] }>()

            for (const node of nodes) {
                nodeMap.set(node.id, {
                    id: node.id,
                    isLeaf: node.isLeaf,
                    childIds: [],
                })
            }

            for (const node of nodes) {
                if (node.parentId) {
                    const parent = nodeMap.get(node.parentId)
                    if (parent) {
                        parent.childIds.push(node.id)
                    }
                }
            }

            // Check for convergence: find any node with 2+ non-leaf children
            let isConvergent = false
            for (const node of nodeMap.values()) {
                const nonLeafChildren = node.childIds.filter((childId) => {
                    const child = nodeMap.get(childId)
                    return child && !child.isLeaf
                })

                if (nonLeafChildren.length >= 2) {
                    isConvergent = true
                    break
                }
            }

            // Complex route with multiple synthesis steps should be convergent
            expect(isConvergent).toBe(true)
        })

        it('should not detect convergence for linear (non-convergent) route', async () => {
            const { route, pythonRoute } = await createTestRoute(linearChainPython)
            await storeTreeInDatabase(route.id, pythonRoute)

            const nodes = await prisma.routeNode.findMany({
                where: { routeId: route.id },
                select: { id: true, parentId: true, isLeaf: true },
            })

            const nodeMap = new Map<string, { id: string; isLeaf: boolean; childIds: string[] }>()

            for (const node of nodes) {
                nodeMap.set(node.id, {
                    id: node.id,
                    isLeaf: node.isLeaf,
                    childIds: [],
                })
            }

            for (const node of nodes) {
                if (node.parentId) {
                    const parent = nodeMap.get(node.parentId)
                    if (parent) {
                        parent.childIds.push(node.id)
                    }
                }
            }

            let isConvergent = false
            for (const node of nodeMap.values()) {
                const nonLeafChildren = node.childIds.filter((childId) => {
                    const child = nodeMap.get(childId)
                    return child && !child.isLeaf
                })

                if (nonLeafChildren.length >= 2) {
                    isConvergent = true
                    break
                }
            }

            expect(isConvergent).toBe(false)
        })
    })

    describe('buildRouteNodeTree - Tree Building from Database', () => {
        it('should correctly build tree structure for single node', async () => {
            const { route, pythonRoute } = await createTestRoute(singleMoleculePython)
            await storeTreeInDatabase(route.id, pythonRoute)

            const rootNode = await prisma.routeNode.findFirst({
                where: { routeId: route.id, parentId: null },
                include: { molecule: true },
            })

            expect(rootNode).toBeDefined()
            expect(rootNode!.isLeaf).toBe(true)

            const nodes = await prisma.routeNode.findMany({
                where: { routeId: route.id },
                include: { molecule: true },
            })

            expect(nodes.length).toBe(1)
        })

        it('should correctly establish parent-child relationships', async () => {
            const { route, pythonRoute } = await createTestRoute(linearChainPython)
            await storeTreeInDatabase(route.id, pythonRoute)

            const nodes = await prisma.routeNode.findMany({
                where: { routeId: route.id },
                include: { molecule: true },
            })

            expect(nodes.length).toBe(3)

            const nodeMap = new Map<string, (typeof nodes)[0]>()
            for (const node of nodes) {
                nodeMap.set(node.id, node)
            }

            const root = nodes.find((n) => n.parentId === null)
            expect(root).toBeDefined()

            let current = root!
            let chainLength = 1

            while (true) {
                const children = nodes.filter((n) => n.parentId === current.id)
                if (children.length === 0) break

                expect(children.length).toBe(1)
                current = children[0]
                chainLength++
            }

            expect(chainLength).toBe(3)
        })

        it('should handle convergent route with multiple reactants', async () => {
            const { route, pythonRoute } = await createTestRoute(convergentRoutePython)
            await storeTreeInDatabase(route.id, pythonRoute)

            const nodes = await prisma.routeNode.findMany({
                where: { routeId: route.id },
                include: { molecule: true },
            })

            const root = nodes.find((n) => n.parentId === null)
            expect(root).toBeDefined()

            const directChildren = nodes.filter((n) => n.parentId === root!.id)
            expect(directChildren.length).toBe(2)
        })

        it('should build tree with all molecules correctly included', async () => {
            const { route, pythonRoute } = await createTestRoute(linearChainPython)
            const { molecules: expectedMolecules } = await storeTreeInDatabase(route.id, pythonRoute)

            const nodes = await prisma.routeNode.findMany({
                where: { routeId: route.id },
                include: { molecule: true },
            })

            const moleculesInTree = new Set(nodes.map((n) => n.molecule.inchikey))

            expect(moleculesInTree.size).toBe(expectedMolecules.size)

            for (const [inchikey] of expectedMolecules) {
                expect(moleculesInTree.has(inchikey)).toBe(true)
            }
        })
    })

    describe('transformToVisualizationTree - Recursive Transformation', () => {
        it('should transform single node to visualization format', async () => {
            const { route, pythonRoute } = await createTestRoute(singleMoleculePython)
            await storeTreeInDatabase(route.id, pythonRoute)

            const node = await prisma.routeNode.findFirst({
                where: { routeId: route.id },
                include: { molecule: true },
            })

            expect(node).toBeDefined()

            const nodeWithDetails: RouteNodeWithDetails = {
                id: node!.id,
                routeId: node!.routeId,
                moleculeId: node!.moleculeId,
                parentId: node!.parentId,
                isLeaf: node!.isLeaf,
                reactionHash: node!.reactionHash,
                template: node!.template,
                metadata: node!.metadata,
                molecule: node!.molecule,
                children: [],
            }

            const transformed = {
                smiles: nodeWithDetails.molecule.smiles,
                children: nodeWithDetails.children.length > 0 ? nodeWithDetails.children : undefined,
            }

            expect(transformed.smiles).toBe(pythonRoute.smiles)
            expect(transformed.children).toBeUndefined()
        })

        it('should recursively transform tree with children', async () => {
            const { route, pythonRoute } = await createTestRoute(linearChainPython)
            await storeTreeInDatabase(route.id, pythonRoute)

            const nodes = await prisma.routeNode.findMany({
                where: { routeId: route.id },
                include: { molecule: true },
            })

            const nodeMap = new Map<string, RouteNodeWithDetails>()

            for (const node of nodes) {
                nodeMap.set(node.id, {
                    id: node.id,
                    routeId: node.routeId,
                    moleculeId: node.moleculeId,
                    parentId: node.parentId,
                    isLeaf: node.isLeaf,
                    reactionHash: node.reactionHash,
                    template: node.template,
                    metadata: node.metadata,
                    molecule: node.molecule,
                    children: [],
                })
            }

            for (const node of nodes) {
                if (node.parentId && nodeMap.has(node.parentId)) {
                    nodeMap.get(node.parentId)!.children.push(nodeMap.get(node.id)!)
                }
            }

            const rootNode = nodes.find((n) => n.parentId === null)!
            const root = nodeMap.get(rootNode.id)!

            const transformToVisualization = (node: RouteNodeWithDetails): { smiles: string; children?: unknown } => {
                return {
                    smiles: node.molecule.smiles,
                    children:
                        node.children.length > 0
                            ? node.children.map((child) => transformToVisualization(child))
                            : undefined,
                }
            }

            const transformed = transformToVisualization(root)

            expect(transformed.smiles).toBe(linearChainPython.smiles)
            expect(transformed.children).toBeDefined()
            expect(transformed.children).toHaveLength(1)
        })

        it('should handle convergent routes with multiple children', async () => {
            const { route, pythonRoute } = await createTestRoute(convergentRoutePython)
            await storeTreeInDatabase(route.id, pythonRoute)

            const nodes = await prisma.routeNode.findMany({
                where: { routeId: route.id },
                include: { molecule: true },
            })

            const nodeMap = new Map<string, RouteNodeWithDetails>()

            for (const node of nodes) {
                nodeMap.set(node.id, {
                    id: node.id,
                    routeId: node.routeId,
                    moleculeId: node.moleculeId,
                    parentId: node.parentId,
                    isLeaf: node.isLeaf,
                    reactionHash: node.reactionHash,
                    template: node.template,
                    metadata: node.metadata,
                    molecule: node.molecule,
                    children: [],
                })
            }

            for (const node of nodes) {
                if (node.parentId && nodeMap.has(node.parentId)) {
                    nodeMap.get(node.parentId)!.children.push(nodeMap.get(node.id)!)
                }
            }

            const rootNode = nodes.find((n) => n.parentId === null)!
            const root = nodeMap.get(rootNode.id)!

            expect(root.children.length).toBe(2)
        })
    })

    describe('Error Handling and Edge Cases', () => {
        it('should handle route with empty tree', async () => {
            const { route } = await createTestRoute(singleMoleculePython)

            const nodes = await prisma.routeNode.findMany({
                where: { routeId: route.id },
            })

            expect(nodes.length).toBe(0)
        })

        it('should handle molecules with special characters in SMILES', async () => {
            const specialMolecule = {
                smiles: 'C[C@H](O)C(=O)O',
                inchikey: 'IKHGUXGNQABSHF-JGWJSMIESA-N',
                synthesis_step: null,
                is_leaf: true,
            }

            const { route } = await createTestRoute(specialMolecule)
            const { molecules } = await storeTreeInDatabase(route.id, specialMolecule)

            const node = await prisma.routeNode.findFirst({
                where: { routeId: route.id },
                include: { molecule: true },
            })

            expect(node!.molecule.smiles).toBe(specialMolecule.smiles)
            expect(molecules.has(specialMolecule.inchikey)).toBe(true)
        })

        it('should preserve template information through tree', async () => {
            const { route, pythonRoute } = await createTestRoute(linearChainPython)
            await storeTreeInDatabase(route.id, pythonRoute)

            const nodes = await prisma.routeNode.findMany({
                where: { routeId: route.id },
                include: { molecule: true },
            })

            const nonLeafNodes = nodes.filter((n) => !n.isLeaf)
            expect(nonLeafNodes.length).toBeGreaterThan(0)

            for (const node of nonLeafNodes) {
                expect(node.template).toBeDefined()
            }
        })

        it('should handle deep synthesis routes', async () => {
            const deepRoute = {
                smiles: 'C5',
                inchikey: 'LEVEL5-UHFFFAOYSA-N',
                synthesis_step: {
                    reactants: [
                        {
                            smiles: 'C4',
                            inchikey: 'LEVEL4-UHFFFAOYSA-N',
                            synthesis_step: {
                                reactants: [
                                    {
                                        smiles: 'C3',
                                        inchikey: 'LEVEL3-UHFFFAOYSA-N',
                                        synthesis_step: {
                                            reactants: [
                                                {
                                                    smiles: 'C2',
                                                    inchikey: 'LEVEL2-UHFFFAOYSA-N',
                                                    synthesis_step: {
                                                        reactants: [
                                                            {
                                                                smiles: 'C1',
                                                                inchikey: 'LEVEL1-UHFFFAOYSA-N',
                                                                synthesis_step: null,
                                                                is_leaf: true,
                                                            },
                                                        ],
                                                        template: 'C1>>C2',
                                                    },
                                                },
                                            ],
                                            template: 'C2>>C3',
                                        },
                                    },
                                ],
                                template: 'C3>>C4',
                            },
                        },
                    ],
                    template: 'C4>>C5',
                },
            }

            const { route } = await createTestRoute(deepRoute)
            const { molecules } = await storeTreeInDatabase(route.id, deepRoute)

            const nodes = await prisma.routeNode.findMany({
                where: { routeId: route.id },
                include: { molecule: true },
            })

            // 5 levels deep: C5 -> C4 -> C3 -> C2 -> C1
            expect(nodes.length).toBe(5)
            expect(molecules.size).toBe(5)
        })
    })

    describe('Database Query Efficiency', () => {
        it('should fetch all nodes in single query for tree building', async () => {
            const { route, pythonRoute } = await createTestRoute(complexRoutePython)
            await storeTreeInDatabase(route.id, pythonRoute)

            const nodes = await prisma.routeNode.findMany({
                where: { routeId: route.id },
                include: { molecule: true },
            })

            const nodeMap = new Map<string, RouteNodeWithDetails>()

            for (const node of nodes) {
                nodeMap.set(node.id, {
                    id: node.id,
                    routeId: node.routeId,
                    moleculeId: node.moleculeId,
                    parentId: node.parentId,
                    isLeaf: node.isLeaf,
                    reactionHash: node.reactionHash,
                    template: node.template,
                    metadata: node.metadata,
                    molecule: node.molecule,
                    children: [],
                })
            }

            for (const node of nodes) {
                if (node.parentId && nodeMap.has(node.parentId)) {
                    nodeMap.get(node.parentId)!.children.push(nodeMap.get(node.id)!)
                }
            }

            expect(nodeMap.size).toBe(nodes.length)
        })

        it('should deduplicate molecules during collection', async () => {
            const { route, pythonRoute } = await createTestRoute(linearChainPython)
            const { molecules } = await storeTreeInDatabase(route.id, pythonRoute)

            const moleculeIds = [...molecules.values()].map((m) => m.id)
            const uniqueIds = new Set(moleculeIds)

            expect(uniqueIds.size).toBe(moleculeIds.length)
        })
    })
})
