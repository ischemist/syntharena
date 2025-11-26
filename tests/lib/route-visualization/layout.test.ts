import { describe, expect, it } from 'vitest'

import type { RouteVisualizationNode } from '@/types'
import { HORIZONTAL_SPACING, NODE_HEIGHT, NODE_WIDTH, VERTICAL_SPACING } from '@/lib/route-visualization/constants'
import {
    assignPositions,
    buildLayoutTree,
    calculateSubtreeWidth,
    collectSmiles,
    flattenLayoutTree,
    layoutTree,
} from '@/lib/route-visualization/layout'

import {
    asymmetricTree,
    balancedTree,
    complexTree,
    deepTree,
    linearChain,
    simpleTree,
    singleNode,
    wideTree,
} from './fixtures'

describe('buildLayoutTree', () => {
    it('should build a single node tree', () => {
        const result = buildLayoutTree(singleNode, 'test-')

        expect(result.id).toBe('test-C')
        expect(result.smiles).toBe('C')
        expect(result.inchikey).toBe(singleNode.inchikey)
        expect(result.children).toHaveLength(0)
    })

    it('should build a simple tree with children', () => {
        const result = buildLayoutTree(simpleTree, 'test-')

        expect(result.id).toBe('test-CCCO')
        expect(result.smiles).toBe('CCCO')
        expect(result.inchikey).toBe(simpleTree.inchikey)
        expect(result.children).toHaveLength(2)
        expect(result.children[0].id).toBe('test-CCCO-0-CCO')
        expect(result.children[1].id).toBe('test-CCCO-1-C')
    })

    it('should create unique hierarchical IDs for nested nodes', () => {
        const result = buildLayoutTree(linearChain, 'prefix-')

        expect(result.id).toBe('prefix-C')
        expect(result.children[0].id).toBe('prefix-C-0-CC')
        expect(result.children[0].children[0].id).toBe('prefix-C-0-CC-0-CCC')
    })

    it('should handle empty children array', () => {
        const testNode: RouteVisualizationNode = { smiles: 'TEST', inchikey: 'TEST-KEY', children: [] }
        const result = buildLayoutTree(testNode, 'test-')

        expect(result.children).toHaveLength(0)
    })

    it('should handle undefined children', () => {
        const testNode: RouteVisualizationNode = { smiles: 'TEST', inchikey: 'TEST-KEY' }
        const result = buildLayoutTree(testNode, 'test-')

        expect(result.children).toHaveLength(0)
    })
})

describe('calculateSubtreeWidth', () => {
    it('should return NODE_WIDTH for a leaf node', () => {
        const node = buildLayoutTree(singleNode, 'test-')
        const width = calculateSubtreeWidth(node)

        expect(width).toBe(NODE_WIDTH)
        expect(node.width).toBe(NODE_WIDTH)
    })

    it('should calculate correct width for simple tree with 2 children', () => {
        const node = buildLayoutTree(simpleTree, 'test-')
        const width = calculateSubtreeWidth(node)

        // Two children: each NODE_WIDTH + one HORIZONTAL_SPACING between them
        const expectedWidth = NODE_WIDTH * 2 + HORIZONTAL_SPACING
        expect(width).toBe(expectedWidth)
        expect(node.width).toBe(expectedWidth)
    })

    it('should calculate correct width for wide tree', () => {
        const node = buildLayoutTree(wideTree, 'test-')
        const width = calculateSubtreeWidth(node)

        // 6 children: 6 * NODE_WIDTH + 5 * HORIZONTAL_SPACING
        const expectedWidth = NODE_WIDTH * 6 + HORIZONTAL_SPACING * 5
        expect(width).toBe(expectedWidth)
    })

    it('should calculate correct width for balanced tree', () => {
        const node = buildLayoutTree(balancedTree, 'test-')
        const width = calculateSubtreeWidth(node)

        // Each second-level node has 2 children: 2*NODE_WIDTH + HORIZONTAL_SPACING
        const secondLevelWidth = NODE_WIDTH * 2 + HORIZONTAL_SPACING
        // Top level has 2 second-level nodes + spacing between them
        const expectedWidth = secondLevelWidth * 2 + HORIZONTAL_SPACING
        expect(width).toBe(expectedWidth)
    })

    it('should return NODE_WIDTH for linear chain (single child at each level)', () => {
        const node = buildLayoutTree(linearChain, 'test-')
        const width = calculateSubtreeWidth(node)

        expect(width).toBe(NODE_WIDTH)
    })

    it('should set width property on all nodes recursively', () => {
        const node = buildLayoutTree(balancedTree, 'test-')
        calculateSubtreeWidth(node)

        // Check all nodes have width set
        expect(node.width).toBeDefined()
        node.children.forEach((child) => {
            expect(child.width).toBeDefined()
            child.children.forEach((grandchild) => {
                expect(grandchild.width).toBeDefined()
            })
        })
    })
})

describe('assignPositions', () => {
    it('should assign (0, 0) to root of single node', () => {
        const node = buildLayoutTree(singleNode, 'test-')
        calculateSubtreeWidth(node)
        assignPositions(node, 0, 0)

        expect(node.x).toBe(0)
        expect(node.y).toBe(0)
    })

    it('should center node within its allocated width', () => {
        const node = buildLayoutTree(simpleTree, 'test-')
        calculateSubtreeWidth(node)
        assignPositions(node, 0, 0)

        // Root should be centered within its total width
        const expectedX = (node.width! - NODE_WIDTH) / 2
        expect(node.x).toBe(expectedX)
        expect(node.y).toBe(0)
    })

    it('should position children in left-to-right order', () => {
        const node = buildLayoutTree(simpleTree, 'test-')
        calculateSubtreeWidth(node)
        assignPositions(node, 0, 0)

        const [child1, child2] = node.children

        // First child should start at x=0
        expect(child1.x).toBe(0)

        // Second child should be to the right of first child
        expect(child2.x).toBeGreaterThan(child1.x!)

        // Both children should be at same y (one level down)
        expect(child1.y).toBe(NODE_HEIGHT + VERTICAL_SPACING)
        expect(child2.y).toBe(NODE_HEIGHT + VERTICAL_SPACING)
    })

    it('should maintain correct spacing between siblings', () => {
        const node = buildLayoutTree(wideTree, 'test-')
        calculateSubtreeWidth(node)
        assignPositions(node, 0, 0)

        for (let i = 0; i < node.children.length - 1; i++) {
            const current = node.children[i]
            const next = node.children[i + 1]

            // Distance between nodes should be NODE_WIDTH + HORIZONTAL_SPACING
            const distance = next.x! - current.x!
            expect(distance).toBe(NODE_WIDTH + HORIZONTAL_SPACING)
        }
    })

    it('should position nodes at correct depth levels', () => {
        const node = buildLayoutTree(deepTree, 'test-')
        calculateSubtreeWidth(node)
        assignPositions(node, 0, 0)

        let currentNode = node
        let expectedY = 0

        while (currentNode.children.length > 0) {
            expect(currentNode.y).toBe(expectedY)
            expectedY += NODE_HEIGHT + VERTICAL_SPACING
            currentNode = currentNode.children[0]
        }

        // Check final leaf node
        expect(currentNode.y).toBe(expectedY)
    })

    it('should handle offset starting positions', () => {
        const node = buildLayoutTree(singleNode, 'test-')
        calculateSubtreeWidth(node)
        assignPositions(node, 100, 200)

        expect(node.x).toBe(100)
        expect(node.y).toBe(200)
    })
})

describe('flattenLayoutTree', () => {
    it('should flatten single node with no edges', () => {
        const node = buildLayoutTree(singleNode, 'test-')
        calculateSubtreeWidth(node)
        assignPositions(node, 0, 0)

        const nodes: Array<{ id: string; smiles: string; inchikey: string; x: number; y: number }> = []
        const edges: Array<{ source: string; target: string }> = []

        flattenLayoutTree(node, nodes, edges, null)

        expect(nodes).toHaveLength(1)
        expect(edges).toHaveLength(0)
        expect(nodes[0]).toEqual({
            id: 'test-C',
            smiles: 'C',
            inchikey: singleNode.inchikey,
            x: 0,
            y: 0,
        })
    })

    it('should create edges from parent to children', () => {
        const node = buildLayoutTree(simpleTree, 'test-')
        calculateSubtreeWidth(node)
        assignPositions(node, 0, 0)

        const nodes: Array<{ id: string; smiles: string; inchikey: string; x: number; y: number }> = []
        const edges: Array<{ source: string; target: string }> = []

        flattenLayoutTree(node, nodes, edges, null)

        expect(nodes).toHaveLength(3)
        expect(edges).toHaveLength(2)

        // Verify edges connect parent to children
        expect(edges[0]).toEqual({ source: 'test-CCCO', target: 'test-CCCO-0-CCO' })
        expect(edges[1]).toEqual({ source: 'test-CCCO', target: 'test-CCCO-1-C' })
    })

    it('should flatten complete tree structure', () => {
        const node = buildLayoutTree(balancedTree, 'test-')
        calculateSubtreeWidth(node)
        assignPositions(node, 0, 0)

        const nodes: Array<{ id: string; smiles: string; inchikey: string; x: number; y: number }> = []
        const edges: Array<{ source: string; target: string }> = []

        flattenLayoutTree(node, nodes, edges, null)

        // Balanced tree has 7 nodes
        expect(nodes).toHaveLength(7)
        // 6 edges (every node except root has a parent)
        expect(edges).toHaveLength(6)

        // All nodes should have positions
        nodes.forEach((n) => {
            expect(n.x).toBeGreaterThanOrEqual(0)
            expect(n.y).toBeGreaterThanOrEqual(0)
        })
    })

    it('should preserve all SMILES strings', () => {
        const node = buildLayoutTree(complexTree, 'test-')
        calculateSubtreeWidth(node)
        assignPositions(node, 0, 0)

        const nodes: Array<{ id: string; smiles: string; inchikey: string; x: number; y: number }> = []
        const edges: Array<{ source: string; target: string }> = []

        flattenLayoutTree(node, nodes, edges, null)

        const smilesSet = new Set<string>()
        collectSmiles(complexTree, smilesSet)

        // All SMILES should be present
        const flattenedSmiles = new Set(nodes.map((n) => n.smiles))
        expect(flattenedSmiles.size).toBe(smilesSet.size)
    })
})

describe('layoutTree', () => {
    it('should perform complete layout pipeline for single node', () => {
        const result = layoutTree(singleNode, 'test-')

        expect(result.nodes).toHaveLength(1)
        expect(result.edges).toHaveLength(0)
        expect(result.nodes[0]).toMatchObject({
            id: 'test-C',
            smiles: 'C',
            x: 0,
            y: 0,
        })
    })

    it('should perform complete layout pipeline for simple tree', () => {
        const result = layoutTree(simpleTree, 'test-')

        expect(result.nodes).toHaveLength(3)
        expect(result.edges).toHaveLength(2)

        // Root should be centered
        const root = result.nodes[0]
        expect(root.smiles).toBe('CCCO')
        expect(root.y).toBe(0)

        // Children should be at second level
        const children = result.nodes.slice(1)
        children.forEach((child) => {
            expect(child.y).toBe(NODE_HEIGHT + VERTICAL_SPACING)
        })
    })

    it('should ensure no node overlaps horizontally at same level', () => {
        const result = layoutTree(wideTree, 'test-')

        // Get all nodes at level 1 (children of root)
        const level1Nodes = result.nodes.filter((n) => n.y === NODE_HEIGHT + VERTICAL_SPACING)

        // Sort by x position
        const sorted = [...level1Nodes].sort((a, b) => a.x - b.x)

        // Check no overlaps
        for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i]
            const next = sorted[i + 1]

            // Next node should start after current node ends
            expect(next.x).toBeGreaterThanOrEqual(current.x + NODE_WIDTH)
        }
    })

    it('should handle complex trees correctly', () => {
        const result = layoutTree(complexTree, 'test-')

        // Should have correct node count
        const smilesSet = new Set<string>()
        collectSmiles(complexTree, smilesSet)
        expect(result.nodes).toHaveLength(smilesSet.size)

        // Should have correct edge count (nodes - 1)
        expect(result.edges).toHaveLength(result.nodes.length - 1)

        // All nodes should have valid positions
        result.nodes.forEach((node) => {
            expect(node.x).toBeGreaterThanOrEqual(0)
            expect(node.y).toBeGreaterThanOrEqual(0)
        })

        // All edges should reference valid nodes
        const nodeIds = new Set(result.nodes.map((n) => n.id))
        result.edges.forEach((edge) => {
            expect(nodeIds.has(edge.source)).toBe(true)
            expect(nodeIds.has(edge.target)).toBe(true)
        })
    })

    it('should maintain parent-child relationships in edges', () => {
        const result = layoutTree(balancedTree, 'test-')

        // Build a map of edges
        const childToParent = new Map<string, string>()
        result.edges.forEach((edge) => {
            childToParent.set(edge.target, edge.source)
        })

        // Verify structure: root has no parent, all others have exactly one parent
        const rootId = result.nodes[0].id
        result.nodes.forEach((node) => {
            if (node.id === rootId) {
                expect(childToParent.has(node.id)).toBe(false)
            } else {
                expect(childToParent.has(node.id)).toBe(true)
            }
        })
    })
})

describe('collectSmiles', () => {
    it('should collect single SMILES from leaf node', () => {
        const set = new Set<string>()
        collectSmiles(singleNode, set)

        expect(set.size).toBe(1)
        expect(set.has('C')).toBe(true)
    })

    it('should collect all SMILES from simple tree', () => {
        const set = new Set<string>()
        collectSmiles(simpleTree, set)

        expect(set.size).toBe(3)
        expect(set.has('CCCO')).toBe(true)
        expect(set.has('CCO')).toBe(true)
        expect(set.has('C')).toBe(true)
    })

    it('should handle deep nested structures', () => {
        const set = new Set<string>()
        collectSmiles(deepTree, set)

        expect(set.size).toBe(6)
        expect(set.has('A')).toBe(true)
        expect(set.has('B')).toBe(true)
        expect(set.has('C')).toBe(true)
        expect(set.has('D')).toBe(true)
        expect(set.has('E')).toBe(true)
        expect(set.has('F')).toBe(true)
    })

    it('should handle complex tree with all branches', () => {
        const set = new Set<string>()
        collectSmiles(asymmetricTree, set)

        expect(set.size).toBe(8)
        expect(set.has('A')).toBe(true)
        expect(set.has('B')).toBe(true)
        expect(set.has('C')).toBe(true)
        expect(set.has('D')).toBe(true)
        expect(set.has('E')).toBe(true)
        expect(set.has('F')).toBe(true)
        expect(set.has('G')).toBe(true)
        expect(set.has('H')).toBe(true)
    })

    it('should add to existing set', () => {
        const set = new Set<string>(['EXISTING'])
        collectSmiles(simpleTree, set)

        expect(set.size).toBe(4)
        expect(set.has('EXISTING')).toBe(true)
    })

    it('should handle duplicate SMILES in tree (if they exist)', () => {
        // Create a tree with duplicate SMILES
        const treeWithDuplicates: RouteVisualizationNode = {
            smiles: 'A',
            inchikey: 'INCHIKEY-A',
            children: [
                { smiles: 'B', inchikey: 'INCHIKEY-B' },
                { smiles: 'B', inchikey: 'INCHIKEY-B' },
            ],
        }

        const set = new Set<string>()
        collectSmiles(treeWithDuplicates, set)

        // Set should deduplicate
        expect(set.size).toBe(2)
        expect(set.has('A')).toBe(true)
        expect(set.has('B')).toBe(true)
    })
})

describe('Global Layout Invariants', () => {
    it('should ensure all nodes have non-negative coordinates', () => {
        const trees = [singleNode, simpleTree, balancedTree, complexTree, wideTree, deepTree]

        trees.forEach((tree) => {
            const result = layoutTree(tree, 'test-')

            result.nodes.forEach((node) => {
                expect(node.x).toBeGreaterThanOrEqual(0)
                expect(node.y).toBeGreaterThanOrEqual(0)
            })
        })
    })

    it('should ensure children are always positioned below parents in y-axis', () => {
        const result = layoutTree(balancedTree, 'test-')

        // Build parent-child map
        const childToParent = new Map<string, string>()
        const nodeMap = new Map(result.nodes.map((n) => [n.id, n]))

        result.edges.forEach((edge) => {
            childToParent.set(edge.target, edge.source)
        })

        // Verify every child is below its parent
        childToParent.forEach((parentId, childId) => {
            const parentNode = nodeMap.get(parentId)
            const childNode = nodeMap.get(childId)

            expect(childNode!.y).toBeGreaterThan(parentNode!.y)
        })
    })

    it('should produce exactly (n-1) edges for n nodes', () => {
        const trees = [singleNode, simpleTree, balancedTree, complexTree, asymmetricTree, deepTree, wideTree]

        trees.forEach((tree) => {
            const result = layoutTree(tree, 'test-')

            expect(result.edges.length).toBe(result.nodes.length - 1)
        })
    })

    it('should ensure all node coordinates are numbers', () => {
        const result = layoutTree(complexTree, 'test-')

        result.nodes.forEach((node) => {
            expect(typeof node.x).toBe('number')
            expect(typeof node.y).toBe('number')
            expect(Number.isFinite(node.x)).toBe(true)
            expect(Number.isFinite(node.y)).toBe(true)
        })
    })

    it('should have no node overlaps at same level (within NODE_WIDTH margin)', () => {
        const result = layoutTree(wideTree, 'test-')

        // Group nodes by y coordinate
        const nodesByLevel = new Map<number, typeof result.nodes>()
        result.nodes.forEach((node) => {
            if (!nodesByLevel.has(node.y)) {
                nodesByLevel.set(node.y, [])
            }
            nodesByLevel.get(node.y)!.push(node)
        })

        // Check each level for overlaps
        nodesByLevel.forEach((nodesAtLevel) => {
            const sorted = [...nodesAtLevel].sort((a, b) => a.x - b.x)

            for (let i = 0; i < sorted.length - 1; i++) {
                const current = sorted[i]
                const next = sorted[i + 1]

                // Next node should start at or after current node ends
                expect(next.x).toBeGreaterThanOrEqual(current.x + NODE_WIDTH - 1) // Allow 1px rounding tolerance
            }
        })
    })
})

describe('Layout Functions - Input Immutability', () => {
    it('should not mutate input tree in layoutTree', () => {
        const treeClone = JSON.parse(JSON.stringify(simpleTree))

        layoutTree(simpleTree, 'test-')

        expect(simpleTree).toEqual(treeClone)
    })

    it('should not mutate input tree in buildLayoutTree', () => {
        const treeClone = JSON.parse(JSON.stringify(simpleTree))

        buildLayoutTree(simpleTree, 'test-')

        expect(simpleTree).toEqual(treeClone)
    })

    it('should not mutate input tree in collectSmiles', () => {
        const treeClone = JSON.parse(JSON.stringify(complexTree))
        const set = new Set<string>()

        collectSmiles(complexTree, set)

        expect(complexTree).toEqual(treeClone)
    })
})

describe('ID Generation & Uniqueness', () => {
    it('should generate globally unique IDs in simple tree', () => {
        const result = layoutTree(simpleTree, 'test-')
        const ids = result.nodes.map((n) => n.id)

        expect(new Set(ids).size).toBe(ids.length)
    })

    it('should generate globally unique IDs in complex tree', () => {
        const result = layoutTree(complexTree, 'test-')
        const ids = result.nodes.map((n) => n.id)

        expect(new Set(ids).size).toBe(ids.length)
    })

    it('should generate globally unique IDs in balanced tree', () => {
        const result = layoutTree(balancedTree, 'test-')
        const ids = result.nodes.map((n) => n.id)

        expect(new Set(ids).size).toBe(ids.length)
    })

    it('should preserve prefix in all generated IDs', () => {
        const customPrefix = 'custom-prefix-'
        const result = layoutTree(simpleTree, customPrefix)

        result.nodes.forEach((node) => {
            expect(node.id.startsWith(customPrefix)).toBe(true)
        })
    })

    it('should generate different IDs when using different prefixes', () => {
        const result1 = layoutTree(simpleTree, 'prefix1-')
        const result2 = layoutTree(simpleTree, 'prefix2-')

        const ids1 = new Set(result1.nodes.map((n) => n.id))
        const ids2 = new Set(result2.nodes.map((n) => n.id))

        // No overlap between IDs
        ids1.forEach((id) => {
            expect(ids2.has(id)).toBe(false)
        })
    })
})

describe('Large Tree Stress Tests', () => {
    it('should handle large tree without stack overflow', () => {
        // Create a tree with 100 nodes in a balanced structure
        const createLargeTree = (depth: number, branchFactor: number = 3): RouteVisualizationNode => {
            if (depth === 0) {
                return { smiles: `node-${Math.random()}`, inchikey: `INCHIKEY-${Math.random()}` }
            }

            const children: RouteVisualizationNode[] = []
            for (let i = 0; i < branchFactor; i++) {
                children.push(createLargeTree(depth - 1, branchFactor))
            }
            return { smiles: `node-${Math.random()}`, inchikey: `INCHIKEY-${Math.random()}`, children }
        }

        const largeTree = createLargeTree(4, 3) // 3^4 = 81 nodes
        expect(() => {
            layoutTree(largeTree, 'large-')
        }).not.toThrow()
    })

    it('should handle very deep tree without stack overflow', () => {
        const createDeepTree = (depth: number): RouteVisualizationNode => {
            if (depth === 0) {
                return { smiles: 'leaf', inchikey: 'INCHIKEY-LEAF' }
            }
            return { smiles: `node-${depth}`, inchikey: `INCHIKEY-${depth}`, children: [createDeepTree(depth - 1)] }
        }

        const deepTree = createDeepTree(50) // 50 levels deep
        expect(() => {
            layoutTree(deepTree, 'deep-')
        }).not.toThrow()
    })

    it('should produce correct results for large trees', () => {
        const createLargeTree = (nodeCount: number): RouteVisualizationNode => {
            const children: RouteVisualizationNode[] = []
            for (let i = 0; i < nodeCount; i++) {
                children.push({ smiles: `child-${i}`, inchikey: `INCHIKEY-CHILD-${i}` })
            }
            return { smiles: 'root', inchikey: 'INCHIKEY-ROOT', children }
        }

        const largeTree = createLargeTree(50)
        const result = layoutTree(largeTree, 'large-')

        // Verify structure
        expect(result.nodes.length).toBe(51)
        expect(result.edges.length).toBe(50)

        // All nodes at level 1 should have same y
        const level1Nodes = result.nodes.filter((n) => n.smiles !== 'root')
        const level1Y = level1Nodes[0].y
        level1Nodes.forEach((n) => {
            expect(n.y).toBe(level1Y)
        })
    })

    it('should maintain proper spacing even with wide trees', () => {
        const createWideTree = (childCount: number): RouteVisualizationNode => {
            const children: RouteVisualizationNode[] = []
            for (let i = 0; i < childCount; i++) {
                children.push({ smiles: `child-${i}`, inchikey: `INCHIKEY-CHILD-${i}` })
            }
            return { smiles: 'root', inchikey: 'INCHIKEY-ROOT', children }
        }

        const wideTree = createWideTree(20)
        const result = layoutTree(wideTree, 'wide-')

        // Check spacing between children
        const sorted = [...result.nodes].filter((n) => n.smiles !== 'root').sort((a, b) => a.x - b.x)
        for (let i = 0; i < sorted.length - 1; i++) {
            const gap = sorted[i + 1].x - sorted[i].x
            // Gap should be NODE_WIDTH + HORIZONTAL_SPACING
            expect(gap).toBe(NODE_WIDTH + HORIZONTAL_SPACING)
        }
    })
})
