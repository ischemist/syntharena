import { describe, expect, it } from 'vitest'

import { buildRouteGraph, getAllRouteInchiKeysSet } from '@/lib/route-visualization/graph-builder'
import { collectInchiKeys, collectSmiles } from '@/lib/route-visualization/layout'

import { balancedTree, complexTree, simpleTree, singleNode } from './fixtures'

describe('buildRouteGraph', () => {
    it('should build graph for single node with no stock items', () => {
        const inStockInchiKeys = new Set<string>()
        const result = buildRouteGraph(singleNode, inStockInchiKeys, 'test-')

        expect(result.nodes).toHaveLength(1)
        expect(result.edges).toHaveLength(0)

        const node = result.nodes[0]
        expect(node.id).toBe('test-C')
        expect(node.type).toBe('molecule')
        expect(node.data).toEqual({
            smiles: 'C',
            status: 'default',
            inStock: false,
        })
        expect(node.position).toEqual({ x: 0, y: 0 })
    })

    it('should build graph for single node with stock item', () => {
        const inStockInchiKeys = new Set([singleNode.inchikey])
        const result = buildRouteGraph(singleNode, inStockInchiKeys, 'test-')

        const node = result.nodes[0]
        expect(node.data.status).toBe('in-stock')
        expect(node.data.inStock).toBe(true)
    })

    it('should build graph for simple tree with mixed stock status', () => {
        // Only CCO is in stock (using its inchikey)
        const inStockInchiKeys = new Set([simpleTree.children![0].inchikey])
        const result = buildRouteGraph(simpleTree, inStockInchiKeys, 'test-')

        expect(result.nodes).toHaveLength(3)
        expect(result.edges).toHaveLength(2)

        // Check node statuses
        const nodes = result.nodes.reduce(
            (acc, node) => {
                acc[node.data.smiles] = node
                return acc
            },
            {} as Record<string, (typeof result.nodes)[0]>
        )

        expect(nodes['CCCO'].data.status).toBe('default')
        expect(nodes['CCCO'].data.inStock).toBe(false)

        expect(nodes['CCO'].data.status).toBe('in-stock')
        expect(nodes['CCO'].data.inStock).toBe(true)

        expect(nodes['C'].data.status).toBe('default')
        expect(nodes['C'].data.inStock).toBe(false)
    })

    it('should assign correct node types', () => {
        const result = buildRouteGraph(simpleTree, new Set(), 'test-')

        result.nodes.forEach((node) => {
            expect(node.type).toBe('molecule')
        })
    })

    it('should assign correct positions from layout algorithm', () => {
        const result = buildRouteGraph(simpleTree, new Set(), 'test-')

        // Root should be at (0, 0) or nearby (centered)
        const root = result.nodes.find((n) => n.data.smiles === 'CCCO')!
        expect(root.position.x).toBeGreaterThanOrEqual(0)
        expect(root.position.y).toBe(0)

        // Children should be at a lower y position
        const children = result.nodes.filter((n) => n.data.smiles !== 'CCCO')
        children.forEach((child) => {
            expect(child.position.y).toBeGreaterThan(root.position.y)
        })
    })

    it('should create edges with correct styling', () => {
        const result = buildRouteGraph(simpleTree, new Set(), 'test-')

        expect(result.edges).toHaveLength(2)

        result.edges.forEach((edge) => {
            expect(edge.source).toBeDefined()
            expect(edge.target).toBeDefined()
            expect(edge.animated).toBe(false)
            expect(edge.style).toEqual({
                stroke: '#94a3b8',
                strokeWidth: 2,
            })
        })
    })

    it('should create valid edge IDs with prefix', () => {
        const result = buildRouteGraph(simpleTree, new Set(), 'custom-')

        result.edges.forEach((edge, idx) => {
            expect(edge.id).toBe(`custom-edge-${idx}`)
        })
    })

    it('should ensure edges reference valid node IDs', () => {
        const result = buildRouteGraph(balancedTree, new Set(), 'test-')

        const nodeIds = new Set(result.nodes.map((n) => n.id))

        result.edges.forEach((edge) => {
            expect(nodeIds.has(edge.source)).toBe(true)
            expect(nodeIds.has(edge.target)).toBe(true)
        })
    })

    it('should handle all nodes in stock', () => {
        const inchiKeySet = new Set<string>()
        collectInchiKeys(simpleTree, inchiKeySet)

        const result = buildRouteGraph(simpleTree, inchiKeySet, 'test-')

        result.nodes.forEach((node) => {
            expect(node.data.status).toBe('in-stock')
            expect(node.data.inStock).toBe(true)
        })
    })

    it('should handle no nodes in stock', () => {
        const result = buildRouteGraph(simpleTree, new Set(), 'test-')

        result.nodes.forEach((node) => {
            expect(node.data.status).toBe('default')
            expect(node.data.inStock).toBe(false)
        })
    })

    it('should preserve SMILES in node data', () => {
        const result = buildRouteGraph(complexTree, new Set(), 'test-')

        const smilesFromData = new Set(result.nodes.map((n) => n.data.smiles))
        const expectedSmiles = new Set<string>()
        collectSmiles(complexTree, expectedSmiles)

        expect(smilesFromData.size).toBe(expectedSmiles.size)
        expectedSmiles.forEach((smiles) => {
            expect(smilesFromData.has(smiles)).toBe(true)
        })
    })

    it('should handle complex tree structure', () => {
        // Use InChiKeys from the complex tree fixture
        const inStockInchiKeys = new Set([
            complexTree.inchikey, // Target molecule
            complexTree.children![0].children![0].children![0].inchikey, // Aldehyde
            complexTree.children![1].inchikey, // NaCN
        ])

        const result = buildRouteGraph(complexTree, inStockInchiKeys, 'test-')

        // Verify stock statuses
        const nodes = result.nodes.reduce(
            (acc, node) => {
                acc[node.data.smiles] = node
                return acc
            },
            {} as Record<string, (typeof result.nodes)[0]>
        )

        // Check in-stock items
        expect(nodes['CC(C)Cc1ccc(cc1)C(C)C(=O)O'].data.inStock).toBe(true)
        expect(nodes['CC(C)Cc1ccc(cc1)CHO'].data.inStock).toBe(true)
        expect(nodes['NaCN'].data.inStock).toBe(true)

        // Check not in-stock items
        expect(nodes['CC(C)Cc1ccc(cc1)C(C)Cl'].data.inStock).toBe(false)
        expect(nodes['HCl'].data.inStock).toBe(false)
    })
})

describe('getAllRouteInchiKeysSet', () => {
    it('should extract single InChiKey from leaf node', () => {
        const result = getAllRouteInchiKeysSet(singleNode)

        expect(result).toBeInstanceOf(Set)
        expect(result.size).toBe(1)
        expect(result.has(singleNode.inchikey)).toBe(true)
    })

    it('should extract all InChiKeys from simple tree', () => {
        const result = getAllRouteInchiKeysSet(simpleTree)

        expect(result.size).toBe(3)
        expect(result.has(simpleTree.inchikey)).toBe(true)
        expect(result.has(simpleTree.children![0].inchikey)).toBe(true)
        expect(result.has(simpleTree.children![1].inchikey)).toBe(true)
    })

    it('should extract all InChiKeys from balanced tree', () => {
        const result = getAllRouteInchiKeysSet(balancedTree)

        expect(result.size).toBe(7)
        const expectedInchiKeys = new Set<string>()
        collectInchiKeys(balancedTree, expectedInchiKeys)

        expectedInchiKeys.forEach((inchikey) => {
            expect(result.has(inchikey)).toBe(true)
        })
    })

    it('should extract all InChiKeys from complex tree', () => {
        const result = getAllRouteInchiKeysSet(complexTree)

        // Count expected InChiKeys
        const expectedInchiKeys = new Set<string>()
        collectInchiKeys(complexTree, expectedInchiKeys)

        expect(result.size).toBe(expectedInchiKeys.size)
        expectedInchiKeys.forEach((inchikey) => {
            expect(result.has(inchikey)).toBe(true)
        })
    })

    it('should be a Set (not array)', () => {
        const result = getAllRouteInchiKeysSet(simpleTree)
        expect(result).toBeInstanceOf(Set)
    })

    it('should return new Set instance (not mutate input)', () => {
        const result1 = getAllRouteInchiKeysSet(simpleTree)
        const result2 = getAllRouteInchiKeysSet(simpleTree)

        // Should have same content but different instances
        expect(result1).not.toBe(result2)
        expect(result1.size).toBe(result2.size)
    })

    it('should deduplicate if tree has duplicate InChiKeys', () => {
        // Create a tree with duplicate InChiKeys
        const treeWithDuplicates: import('@/types').RouteVisualizationNode = {
            smiles: 'A',
            inchikey: 'INCHIKEY-A',
            children: [
                { smiles: 'B', inchikey: 'INCHIKEY-B' },
                { smiles: 'B', inchikey: 'INCHIKEY-B' },
            ],
        }

        const result = getAllRouteInchiKeysSet(treeWithDuplicates)

        expect(result.size).toBe(2)
        expect(result.has('INCHIKEY-A')).toBe(true)
        expect(result.has('INCHIKEY-B')).toBe(true)
    })
})

describe('Integration: buildRouteGraph + getAllRouteInchiKeysSet', () => {
    it('should use getAllRouteInchiKeysSet result as inStockInchiKeys parameter', () => {
        // Get all InChiKeys from tree
        const allInchiKeys = getAllRouteInchiKeysSet(complexTree)

        // Use them as in-stock items
        const result = buildRouteGraph(complexTree, allInchiKeys, 'test-')

        // All nodes should be in stock
        result.nodes.forEach((node) => {
            expect(node.data.inStock).toBe(true)
            expect(node.data.status).toBe('in-stock')
        })
    })

    it('should correctly handle partial stock matching', () => {
        const allInchiKeys = getAllRouteInchiKeysSet(complexTree)
        // Keep only first 3 items in stock
        const partialStock = new Set([...allInchiKeys].slice(0, 3))

        const result = buildRouteGraph(complexTree, partialStock, 'test-')

        // Check that partial stock is respected - count in-stock items
        let inStockCount = 0
        let defaultCount = 0
        result.nodes.forEach((node) => {
            if (node.data.inStock) {
                inStockCount++
                expect(node.data.status).toBe('in-stock')
            } else {
                defaultCount++
                expect(node.data.status).toBe('default')
            }
        })

        // Partial stock should have exactly 3 in stock
        expect(inStockCount).toBe(3)
        // And the rest should be default
        expect(defaultCount).toBe(result.nodes.length - 3)
    })

    it('should work with different ID prefixes', () => {
        const inchiKeys = getAllRouteInchiKeysSet(simpleTree)

        const result1 = buildRouteGraph(simpleTree, inchiKeys, 'prefix1-')
        const result2 = buildRouteGraph(simpleTree, inchiKeys, 'prefix2-')

        // Both should have same number of nodes
        expect(result1.nodes).toHaveLength(result2.nodes.length)

        // But different IDs
        const ids1 = result1.nodes.map((n) => n.id)
        const ids2 = result2.nodes.map((n) => n.id)

        ids1.forEach((id) => {
            expect(ids2.includes(id)).toBe(false)
        })
    })
})

describe('Graph Structure Integrity', () => {
    it('should produce exactly (n-1) edges for n nodes', () => {
        const trees = [singleNode, simpleTree, balancedTree, complexTree]

        trees.forEach((tree) => {
            const result = buildRouteGraph(tree, new Set(), 'test-')

            expect(result.edges.length).toBe(result.nodes.length - 1)
        })
    })

    it('should ensure all node IDs are globally unique', () => {
        const result = buildRouteGraph(complexTree, new Set(), 'test-')

        const ids = result.nodes.map((n) => n.id)
        const uniqueIds = new Set(ids)

        expect(uniqueIds.size).toBe(ids.length)
    })

    it('should ensure all edge IDs are globally unique', () => {
        const result = buildRouteGraph(balancedTree, new Set(), 'test-')

        const edgeIds = result.edges.map((e) => e.id)
        const uniqueEdgeIds = new Set(edgeIds)

        expect(uniqueEdgeIds.size).toBe(edgeIds.length)
    })

    it('should verify all nodes have required data properties', () => {
        const result = buildRouteGraph(complexTree, new Set(), 'test-')

        result.nodes.forEach((node) => {
            expect(node.data).toHaveProperty('smiles')
            expect(node.data).toHaveProperty('status')
            expect(node.data).toHaveProperty('inStock')

            // Verify types
            expect(typeof node.data.smiles).toBe('string')
            expect(['in-stock', 'default']).toContain(node.data.status)
            expect(typeof node.data.inStock).toBe('boolean')
        })
    })

    it('should ensure all nodes have valid positions', () => {
        const result = buildRouteGraph(complexTree, new Set(), 'test-')

        result.nodes.forEach((node) => {
            expect(typeof node.position.x).toBe('number')
            expect(typeof node.position.y).toBe('number')
            expect(Number.isFinite(node.position.x)).toBe(true)
            expect(Number.isFinite(node.position.y)).toBe(true)
            expect(node.position.x).toBeGreaterThanOrEqual(0)
            expect(node.position.y).toBeGreaterThanOrEqual(0)
        })
    })
})

describe('Mutation & Side Effects', () => {
    it('should not mutate input tree in buildRouteGraph', () => {
        const treeClone = JSON.parse(JSON.stringify(complexTree))

        buildRouteGraph(complexTree, new Set(), 'test-')

        expect(complexTree).toEqual(treeClone)
    })

    it('should not mutate input stock set in buildRouteGraph', () => {
        const stockSet = new Set(['INCHIKEY-A', 'INCHIKEY-B', 'INCHIKEY-C'])
        const stockClone = new Set(stockSet)

        buildRouteGraph(simpleTree, stockSet, 'test-')

        expect(stockSet).toEqual(stockClone)
    })

    it('should not mutate input tree in getAllRouteInchiKeysSet', () => {
        const treeClone = JSON.parse(JSON.stringify(complexTree))

        getAllRouteInchiKeysSet(complexTree)

        expect(complexTree).toEqual(treeClone)
    })

    it('should return independent Set instances', () => {
        const set1 = getAllRouteInchiKeysSet(simpleTree)
        const set2 = getAllRouteInchiKeysSet(simpleTree)

        // Same content but different instances
        expect(set1).not.toBe(set2)
        expect(set1.size).toBe(set2.size)

        // Modifying one shouldn't affect the other
        set1.add('MUTATED')
        expect(set2.has('MUTATED')).toBe(false)
    })

    it('should return independent node arrays', () => {
        const result1 = buildRouteGraph(simpleTree, new Set(), 'prefix1-')
        const result2 = buildRouteGraph(simpleTree, new Set(), 'prefix2-')

        // Different instances
        expect(result1.nodes).not.toBe(result2.nodes)
        expect(result1.edges).not.toBe(result2.edges)

        // But same count
        expect(result1.nodes.length).toBe(result2.nodes.length)
        expect(result1.edges.length).toBe(result2.edges.length)
    })

    it('should not share node data references between calls', () => {
        const result1 = buildRouteGraph(simpleTree, new Set(), 'prefix1-')
        const result2 = buildRouteGraph(simpleTree, new Set(), 'prefix2-')

        // Each node should be a different object
        result1.nodes.forEach((node1) => {
            const sameSmiles = result2.nodes.find((n) => n.data.smiles === node1.data.smiles)
            if (sameSmiles) {
                expect(node1).not.toBe(sameSmiles)
                expect(node1.data).not.toBe(sameSmiles.data)
            }
        })
    })
})

describe('Edge Cases & Robustness', () => {
    it('should handle empty stock set (no molecules in stock)', () => {
        const result = buildRouteGraph(complexTree, new Set(), 'test-')

        // All should be default
        result.nodes.forEach((node) => {
            expect(node.data.inStock).toBe(false)
            expect(node.data.status).toBe('default')
        })
    })

    it('should handle stock set with molecules not in tree', () => {
        const stockSet = new Set(['NOT_IN_TREE', 'ALSO_NOT_HERE', singleNode.inchikey])
        const result = buildRouteGraph(singleNode, stockSet, 'test-')

        // Should not crash and properly identify in-stock items
        const carbon = result.nodes.find((n) => n.data.smiles === 'C')
        expect(carbon!.data.inStock).toBe(true)
    })

    it('should produce valid React Flow structure', () => {
        const result = buildRouteGraph(complexTree, new Set(), 'test-')

        // Verify structure matches React Flow expectations
        result.nodes.forEach((node) => {
            expect(node).toHaveProperty('id')
            expect(node).toHaveProperty('type')
            expect(node).toHaveProperty('position')
            expect(node).toHaveProperty('data')

            expect(typeof node.id).toBe('string')
            expect(node.type).toBe('molecule')
            expect(typeof node.position.x).toBe('number')
            expect(typeof node.position.y).toBe('number')
        })

        result.edges.forEach((edge) => {
            expect(edge).toHaveProperty('id')
            expect(edge).toHaveProperty('source')
            expect(edge).toHaveProperty('target')

            expect(typeof edge.id).toBe('string')
            expect(typeof edge.source).toBe('string')
            expect(typeof edge.target).toBe('string')
        })
    })

    it('should maintain stock status consistency across multiple calls', () => {
        const stockSet = getAllRouteInchiKeysSet(simpleTree)

        const result1 = buildRouteGraph(simpleTree, stockSet, 'test1-')
        const result2 = buildRouteGraph(simpleTree, stockSet, 'test2-')

        // Same stock status despite different prefixes
        const getStatus = (result: ReturnType<typeof buildRouteGraph>) => {
            return result.nodes
                .map((n) => `${n.data.smiles}:${n.data.status}`)
                .sort()
                .join('|')
        }

        expect(getStatus(result1)).toBe(getStatus(result2))
    })
})
