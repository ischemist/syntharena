/**
 * Unit tests for src/lib/tree-builder/route-tree.ts
 *
 * Tests the buildRouteTree pure function that converts flat node arrays
 * into hierarchical trees. Uses carbon chain factories for topology testing.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import type { RouteNodeWithDetails } from '@/types'
import { buildRouteTree } from '@/lib/tree-builder/route-tree'

import {
    computeExpectedDepth,
    countLeafNodes,
    countPythonMoleculeNodes,
    makeBinaryTreePythonRoute,
    makeConvergentPythonRoute,
    makeLinearPythonRoute,
    pythonMoleculeToFlatNodes,
    resetNodeIdCounter,
} from '../../helpers/factories'

beforeEach(() => {
    resetNodeIdCounter()
})

// ============================================================================
// Helper: count nodes in a RouteNodeWithDetails tree
// ============================================================================

function countTreeNodes(node: RouteNodeWithDetails): number {
    return 1 + node.children.reduce((sum, child) => sum + countTreeNodes(child), 0)
}

function treeDepth(node: RouteNodeWithDetails): number {
    if (node.children.length === 0) return 0
    return 1 + Math.max(...node.children.map(treeDepth))
}

function collectAllNodes(node: RouteNodeWithDetails): RouteNodeWithDetails[] {
    return [node, ...node.children.flatMap(collectAllNodes)]
}

// ============================================================================
// buildRouteTree
// ============================================================================

describe('buildRouteTree', () => {
    describe('basic cases', () => {
        it('builds a single-node tree (leaf molecule)', () => {
            const nodes = pythonMoleculeToFlatNodes({
                smiles: 'C',
                inchikey: 'TEST-INCHIKEY-1',
                synthesis_step: null,
            })

            const tree = buildRouteTree(nodes)
            expect(tree.molecule.smiles).toBe('C')
            expect(tree.children).toHaveLength(0)
            expect(tree.parentId).toBeNull()
        })

        it('throws for empty array', () => {
            expect(() => buildRouteTree([])).toThrow('cannot build tree from an empty array')
        })

        it('throws when no root node (no parentId === null)', () => {
            const nodes = pythonMoleculeToFlatNodes({
                smiles: 'C',
                inchikey: 'TEST',
                synthesis_step: null,
            })
            // Corrupt the data: give root a parent
            nodes[0].parentId = 'fake-parent'

            expect(() => buildRouteTree(nodes)).toThrow('no root node found')
        })
    })

    describe('linear routes (carbon chains)', () => {
        it.each([1, 2, 3, 4, 5])('builds linear route of depth %d', (depth) => {
            const route = makeLinearPythonRoute(depth)
            const flatNodes = pythonMoleculeToFlatNodes(route.target)
            const tree = buildRouteTree(flatNodes)

            // Root should have exactly 1 child (linear)
            expect(tree.parentId).toBeNull()

            // Depth should match
            expect(treeDepth(tree)).toBe(depth)

            // Total nodes = depth + 1 (each reaction step adds one node)
            const expectedNodes = countPythonMoleculeNodes(route.target)
            expect(countTreeNodes(tree)).toBe(expectedNodes)
            expect(expectedNodes).toBe(depth + 1)
        })

        it('all leaf nodes are at the bottom of the chain', () => {
            const route = makeLinearPythonRoute(3)
            const flatNodes = pythonMoleculeToFlatNodes(route.target)
            const tree = buildRouteTree(flatNodes)

            // Walk to the deepest node
            let current = tree
            while (current.children.length > 0) {
                expect(current.isLeaf).toBe(false)
                current = current.children[0]
            }
            expect(current.isLeaf).toBe(true)
        })
    })

    describe('convergent routes', () => {
        it('builds convergent route with 2 branches', () => {
            const route = makeConvergentPythonRoute(2)
            const flatNodes = pythonMoleculeToFlatNodes(route.target)
            const tree = buildRouteTree(flatNodes)

            // Root should have 2 children (convergent)
            expect(tree.children).toHaveLength(2)
            expect(tree.parentId).toBeNull()
        })

        it.each([2, 3, 4])('convergent route depth %d has correct depth', (depth) => {
            const route = makeConvergentPythonRoute(depth)
            const flatNodes = pythonMoleculeToFlatNodes(route.target)
            const tree = buildRouteTree(flatNodes)

            expect(treeDepth(tree)).toBe(depth)
        })

        it('all nodes are reachable from root', () => {
            const route = makeConvergentPythonRoute(3)
            const flatNodes = pythonMoleculeToFlatNodes(route.target)
            const tree = buildRouteTree(flatNodes)

            const allTreeNodes = collectAllNodes(tree)
            expect(allTreeNodes).toHaveLength(flatNodes.length)
        })
    })

    describe('binary tree routes', () => {
        it('builds binary tree with correct leaf count', () => {
            const route = makeBinaryTreePythonRoute(2)
            const flatNodes = pythonMoleculeToFlatNodes(route.target)
            const tree = buildRouteTree(flatNodes)

            // Binary tree at depth 2 should have 2^2 = 4 leaves
            const allNodes = collectAllNodes(tree)
            const leaves = allNodes.filter((n) => n.children.length === 0)
            expect(leaves).toHaveLength(4)
        })

        it.each([1, 2, 3])('binary tree depth %d has 2^d leaves', (depth) => {
            const route = makeBinaryTreePythonRoute(depth)
            const flatNodes = pythonMoleculeToFlatNodes(route.target)
            const tree = buildRouteTree(flatNodes)

            const expectedLeaves = countLeafNodes(route.target)
            expect(expectedLeaves).toBe(2 ** depth)

            const allNodes = collectAllNodes(tree)
            const actualLeaves = allNodes.filter((n) => n.children.length === 0)
            expect(actualLeaves).toHaveLength(expectedLeaves)
        })

        it('binary tree has correct total node count', () => {
            const route = makeBinaryTreePythonRoute(2)
            const flatNodes = pythonMoleculeToFlatNodes(route.target)
            const tree = buildRouteTree(flatNodes)

            // Binary tree at depth 2: 2^3 - 1 = 7 nodes
            const expectedTotal = countPythonMoleculeNodes(route.target)
            expect(countTreeNodes(tree)).toBe(expectedTotal)
            expect(expectedTotal).toBe(7)
        })
    })

    describe('edge cases with hand-crafted node arrays', () => {
        it('builds a two-node tree from a manually constructed flat array', () => {
            // Directly construct the flat node shape without going through pythonMoleculeToFlatNodes,
            // verifying buildRouteTree is not coupled to the factory.
            const nodes = [
                {
                    id: 'root-1',
                    routeId: 'r-1',
                    moleculeId: 'mol-1',
                    parentId: null,
                    isLeaf: false,
                    reactionHash: null,
                    template: null,
                    metadata: null,
                    molecule: { id: 'mol-1', inchikey: 'ROOT-INCHIKEY-00001-N', smiles: 'CC' },
                },
                {
                    id: 'child-1',
                    routeId: 'r-1',
                    moleculeId: 'mol-2',
                    parentId: 'root-1',
                    isLeaf: true,
                    reactionHash: null,
                    template: null,
                    metadata: null,
                    molecule: { id: 'mol-2', inchikey: 'LEAF-INCHIKEY-00001-N', smiles: 'C' },
                },
            ]

            const tree = buildRouteTree(nodes)
            expect(tree.id).toBe('root-1')
            expect(tree.molecule.smiles).toBe('CC')
            expect(tree.children).toHaveLength(1)
            expect(tree.children[0].id).toBe('child-1')
            expect(tree.children[0].isLeaf).toBe(true)
        })

        it('silently picks first root when multiple nodes have parentId === null', () => {
            // Documents the current behaviour: Array.find returns the first match.
            // The second "root" node and its subtree are unreachable.
            const nodes = [
                {
                    id: 'root-a',
                    routeId: 'r-x',
                    moleculeId: 'mol-a',
                    parentId: null,
                    isLeaf: true,
                    reactionHash: null,
                    template: null,
                    metadata: null,
                    molecule: { id: 'mol-a', inchikey: 'ROOTA-INCHIKEY-0001-N', smiles: 'C' },
                },
                {
                    id: 'root-b',
                    routeId: 'r-x',
                    moleculeId: 'mol-b',
                    parentId: null, // second "root" — orphaned under current implementation
                    isLeaf: true,
                    reactionHash: null,
                    template: null,
                    metadata: null,
                    molecule: { id: 'mol-b', inchikey: 'ROOTB-INCHIKEY-0001-N', smiles: 'CC' },
                },
            ]

            const tree = buildRouteTree(nodes)
            // First root wins
            expect(tree.id).toBe('root-a')
            // The second "root" is not reachable as a child of root-a
            expect(tree.children).toHaveLength(0)
        })

        it('silently drops orphan nodes (parentId references non-existent node)', () => {
            // Documents current behaviour: the orphan is added to its non-existent parent's
            // children list (which never gets populated), so it is unreachable from the root.
            const nodes = [
                {
                    id: 'root-1',
                    routeId: 'r-y',
                    moleculeId: 'mol-r',
                    parentId: null,
                    isLeaf: false,
                    reactionHash: null,
                    template: null,
                    metadata: null,
                    molecule: { id: 'mol-r', inchikey: 'ROOTR-INCHIKEY-0001-N', smiles: 'CCC' },
                },
                {
                    id: 'orphan-1',
                    routeId: 'r-y',
                    moleculeId: 'mol-o',
                    parentId: 'does-not-exist', // dangling parent reference
                    isLeaf: true,
                    reactionHash: null,
                    template: null,
                    metadata: null,
                    molecule: { id: 'mol-o', inchikey: 'ORPHN-INCHIKEY-0001-N', smiles: 'C' },
                },
            ]

            const tree = buildRouteTree(nodes)
            expect(tree.id).toBe('root-1')
            // Orphan is not reachable — root has no children despite having a non-leaf flag
            const allNodes = collectAllNodes(tree)
            expect(allNodes).toHaveLength(1)
        })
    })

    describe('invariants', () => {
        it('every node has a valid molecule with smiles and inchikey', () => {
            const route = makeConvergentPythonRoute(3)
            const flatNodes = pythonMoleculeToFlatNodes(route.target)
            const tree = buildRouteTree(flatNodes)

            const allNodes = collectAllNodes(tree)
            for (const node of allNodes) {
                expect(node.molecule).toBeDefined()
                expect(node.molecule.smiles).toBeTruthy()
                expect(node.molecule.inchikey).toBeTruthy()
            }
        })

        it('root node always has parentId === null', () => {
            const route = makeBinaryTreePythonRoute(2)
            const flatNodes = pythonMoleculeToFlatNodes(route.target)
            const tree = buildRouteTree(flatNodes)

            expect(tree.parentId).toBeNull()
        })

        it('tree depth matches factory expected depth', () => {
            const route = makeLinearPythonRoute(5)
            const flatNodes = pythonMoleculeToFlatNodes(route.target)
            const tree = buildRouteTree(flatNodes)

            const expectedDepth = computeExpectedDepth(route.target)
            expect(treeDepth(tree)).toBe(expectedDepth)
            expect(expectedDepth).toBe(5)
        })
    })
})
