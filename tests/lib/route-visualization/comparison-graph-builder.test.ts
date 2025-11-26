import { describe, expect, it } from 'vitest'

import type { RouteVisualizationNode } from '@/types'
import { buildDiffOverlayGraph, buildSideBySideGraph } from '@/lib/route-visualization'

describe('Route Comparison Graph Builders', () => {
    // Sample routes for testing
    const groundTruthRoute: RouteVisualizationNode = {
        smiles: 'CCO',
        inchikey: 'LFQSCWFLJHTTHZ-UHFFFAOYSA-N',
        children: [
            {
                smiles: 'CC',
                inchikey: 'OTMSDBZUPAUEDD-UHFFFAOYSA-N',
                children: [],
            },
            {
                smiles: 'O',
                inchikey: 'XLYOFNOQVPJJNP-UHFFFAOYSA-N',
                children: [],
            },
        ],
    }

    const predictionRoute: RouteVisualizationNode = {
        smiles: 'CCO',
        inchikey: 'LFQSCWFLJHTTHZ-UHFFFAOYSA-N',
        children: [
            {
                smiles: 'CC',
                inchikey: 'OTMSDBZUPAUEDD-UHFFFAOYSA-N',
                children: [],
            },
            {
                // Hallucinated node - not in ground truth
                smiles: 'CO',
                inchikey: 'OKKJLVBELUTLKV-UHFFFAOYSA-N',
                children: [],
            },
        ],
    }

    describe('buildSideBySideGraph', () => {
        it('should mark all ground truth nodes as match', () => {
            const gtInchiKeys = new Set([
                'LFQSCWFLJHTTHZ-UHFFFAOYSA-N',
                'OTMSDBZUPAUEDD-UHFFFAOYSA-N',
                'XLYOFNOQVPJJNP-UHFFFAOYSA-N',
            ])
            const predInchiKeys = new Set([
                'LFQSCWFLJHTTHZ-UHFFFAOYSA-N',
                'OTMSDBZUPAUEDD-UHFFFAOYSA-N',
                'OKKJLVBELUTLKV-UHFFFAOYSA-N',
            ])
            const result = buildSideBySideGraph(
                groundTruthRoute,
                predictionRoute,
                gtInchiKeys,
                predInchiKeys,
                true,
                'gt_'
            )

            expect(result.nodes).toHaveLength(3)
            result.nodes.forEach((node) => {
                expect(node.data.status).toBe('match')
            })
        })

        it('should mark prediction nodes as match or extension', () => {
            const gtInchiKeys = new Set([
                'LFQSCWFLJHTTHZ-UHFFFAOYSA-N',
                'OTMSDBZUPAUEDD-UHFFFAOYSA-N',
                'XLYOFNOQVPJJNP-UHFFFAOYSA-N',
            ])
            const predInchiKeys = new Set([
                'LFQSCWFLJHTTHZ-UHFFFAOYSA-N',
                'OTMSDBZUPAUEDD-UHFFFAOYSA-N',
                'OKKJLVBELUTLKV-UHFFFAOYSA-N',
            ])
            const result = buildSideBySideGraph(
                predictionRoute,
                groundTruthRoute,
                gtInchiKeys,
                predInchiKeys,
                false,
                'pred_'
            )

            // Now includes ghost node from GT, so should have 4 nodes
            expect(result.nodes).toHaveLength(4)

            // Check root and first child are matches
            const rootNode = result.nodes.find((n) => n.data.smiles === 'CCO')
            expect(rootNode?.data.status).toBe('match')

            const matchChild = result.nodes.find((n) => n.data.smiles === 'CC')
            expect(matchChild?.data.status).toBe('match')

            // Check second child is extension
            const extensionChild = result.nodes.find((n) => n.data.smiles === 'CO')
            expect(extensionChild?.data.status).toBe('extension')

            // Check ghost node from GT
            const ghostNode = result.nodes.find((n) => n.data.smiles === 'O')
            expect(ghostNode?.data.status).toBe('ghost')
        })

        it('should create correct edges', () => {
            const gtInchiKeys = new Set([
                'LFQSCWFLJHTTHZ-UHFFFAOYSA-N',
                'OTMSDBZUPAUEDD-UHFFFAOYSA-N',
                'XLYOFNOQVPJJNP-UHFFFAOYSA-N',
            ])
            const predInchiKeys = new Set([
                'LFQSCWFLJHTTHZ-UHFFFAOYSA-N',
                'OTMSDBZUPAUEDD-UHFFFAOYSA-N',
                'OKKJLVBELUTLKV-UHFFFAOYSA-N',
            ])
            const result = buildSideBySideGraph(
                groundTruthRoute,
                predictionRoute,
                gtInchiKeys,
                predInchiKeys,
                true,
                'gt_'
            )

            expect(result.edges).toHaveLength(2) // root -> 2 children
            result.edges.forEach((edge) => {
                expect(edge.source).toMatch(/^gt_/)
                expect(edge.target).toMatch(/^gt_/)
            })
        })
    })

    describe('buildDiffOverlayGraph', () => {
        it('should merge routes correctly', () => {
            const result = buildDiffOverlayGraph(groundTruthRoute, predictionRoute)

            // Should have root + 3 children (CC matches, O is ghost, CO is hallucination)
            expect(result.nodes.length).toBeGreaterThanOrEqual(3)
        })

        it('should mark matching nodes correctly', () => {
            const result = buildDiffOverlayGraph(groundTruthRoute, predictionRoute)

            // Root should be a match (in both)
            const rootNode = result.nodes.find((n) => n.data.smiles === 'CCO')
            expect(rootNode?.data.status).toBe('match')

            // CC should be a match (in both)
            const matchChild = result.nodes.find((n) => n.data.smiles === 'CC')
            expect(matchChild?.data.status).toBe('match')
        })

        it('should mark ghost nodes correctly', () => {
            const result = buildDiffOverlayGraph(groundTruthRoute, predictionRoute)

            // O should be ghost (in GT but not prediction)
            const ghostNode = result.nodes.find((n) => n.data.smiles === 'O')
            expect(ghostNode?.data.status).toBe('ghost')
        })

        it('should mark extension nodes correctly', () => {
            const result = buildDiffOverlayGraph(groundTruthRoute, predictionRoute)

            // CO should be extension (in prediction but not GT)
            const extensionNode = result.nodes.find((n) => n.data.smiles === 'CO')
            expect(extensionNode?.data.status).toBe('extension')
        })

        it('should create dashed edges for ghost nodes', () => {
            const result = buildDiffOverlayGraph(groundTruthRoute, predictionRoute)

            // Find edge connected to ghost node
            const ghostNode = result.nodes.find((n) => n.data.status === 'ghost')
            if (ghostNode) {
                const ghostEdge = result.edges.find((e) => e.target === ghostNode.id)
                expect(ghostEdge?.style?.strokeDasharray).toBe('5,5')
            }
        })

        it('should handle identical routes', () => {
            const identicalRoute: RouteVisualizationNode = {
                smiles: 'CCO',
                inchikey: 'LFQSCWFLJHTTHZ-UHFFFAOYSA-N',
                children: [],
            }

            const result = buildDiffOverlayGraph(identicalRoute, identicalRoute)

            expect(result.nodes).toHaveLength(1)
            expect(result.nodes[0].data.status).toBe('match')
            expect(result.edges).toHaveLength(0)
        })

        it('should handle empty children arrays', () => {
            const leafRoute: RouteVisualizationNode = {
                smiles: 'CCO',
                inchikey: 'LFQSCWFLJHTTHZ-UHFFFAOYSA-N',
                children: [],
            }

            const gtInchiKeys = new Set(['LFQSCWFLJHTTHZ-UHFFFAOYSA-N'])
            const predInchiKeys = new Set(['LFQSCWFLJHTTHZ-UHFFFAOYSA-N'])
            const result = buildSideBySideGraph(leafRoute, leafRoute, gtInchiKeys, predInchiKeys, false, 'test_')

            expect(result.nodes).toHaveLength(1)
            expect(result.edges).toHaveLength(0)
        })
    })
})
