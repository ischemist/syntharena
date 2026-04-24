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
        it('should mark ground truth nodes absent from prediction as ghost', () => {
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
            expect(result.nodes.find((node) => node.data.smiles === 'CCO')?.data.status).toBe('match')
            expect(result.nodes.find((node) => node.data.smiles === 'CC')?.data.status).toBe('match')
            expect(result.nodes.find((node) => node.data.smiles === 'O')?.data.status).toBe('ghost')
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

            // Side-by-side only shows actual nodes in the prediction route (3 nodes)
            // Ghost nodes are only shown in diff-overlay mode
            expect(result.nodes).toHaveLength(3)

            // Check root and first child are matches
            const rootNode = result.nodes.find((n) => n.data.smiles === 'CCO')
            expect(rootNode?.data.status).toBe('match')

            const matchChild = result.nodes.find((n) => n.data.smiles === 'CC')
            expect(matchChild?.data.status).toBe('match')

            // Check second child is extension (not in GT)
            const extensionChild = result.nodes.find((n) => n.data.smiles === 'CO')
            expect(extensionChild?.data.status).toBe('extension')

            // Verify no ghost node in side-by-side (it would only appear in diff-overlay)
            const ghostNode = result.nodes.find((n) => n.data.smiles === 'O')
            expect(ghostNode).toBeUndefined()
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

        it('should highlight skipped intermediates as topology deviations', () => {
            const acceptableRoute: RouteVisualizationNode = {
                smiles: 'A',
                inchikey: 'A',
                children: [
                    {
                        smiles: 'B',
                        inchikey: 'B',
                        children: [
                            {
                                smiles: 'C',
                                inchikey: 'C',
                                children: [
                                    {
                                        smiles: 'D',
                                        inchikey: 'D',
                                        children: [],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            }
            const predictionRoute: RouteVisualizationNode = {
                smiles: 'A',
                inchikey: 'A',
                children: [
                    {
                        smiles: 'C',
                        inchikey: 'C',
                        children: [],
                    },
                ],
            }
            const acceptableInchiKeys = new Set(['A', 'B', 'C', 'D'])
            const predictionInchiKeys = new Set(['A', 'C'])

            const acceptableGraph = buildSideBySideGraph(
                acceptableRoute,
                predictionRoute,
                acceptableInchiKeys,
                predictionInchiKeys,
                true,
                'acceptable_'
            )
            const predictionGraph = buildSideBySideGraph(
                predictionRoute,
                acceptableRoute,
                acceptableInchiKeys,
                predictionInchiKeys,
                false,
                'prediction_'
            )

            expect(acceptableGraph.nodes.find((node) => node.data.smiles === 'A')?.data.status).toBe('match')
            expect(acceptableGraph.nodes.find((node) => node.data.smiles === 'B')?.data.status).toBe('ghost')
            expect(acceptableGraph.nodes.find((node) => node.data.smiles === 'C')?.data.status).toBe('ghost')
            expect(acceptableGraph.nodes.find((node) => node.data.smiles === 'D')?.data.status).toBe('ghost')

            expect(predictionGraph.nodes.find((node) => node.data.smiles === 'A')?.data.status).toBe('match')
            expect(predictionGraph.nodes.find((node) => node.data.smiles === 'C')?.data.status).toBe('extension')
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
