/**
 * Transforms route tree into React Flow nodes and edges.
 * Handles single route visualization with stock availability.
 */

import type { Edge, Node } from '@xyflow/react'

import type { RouteGraphNode, RouteVisualizationNode } from '@/types'

import { collectInchiKeys, layoutTree } from './layout'

/**
 * Builds React Flow graph from a visualization tree.
 * Integrates layout positioning and stock availability.
 * Uses InChiKeys for reliable stock comparison.
 */
export function buildRouteGraph(
    route: RouteVisualizationNode,
    inStockInchiKeys: Set<string>,
    idPrefix: string
): { nodes: Node<RouteGraphNode>[]; edges: Edge[] } {
    // Get layout positions
    const { nodes: layoutNodes, edges: layoutEdges } = layoutTree(route, idPrefix)

    // Build React Flow nodes with status
    const nodes: Node<RouteGraphNode>[] = layoutNodes.map((n) => {
        const inStock = inStockInchiKeys.has(n.inchikey)
        return {
            id: n.id,
            type: 'molecule',
            position: { x: n.x, y: n.y },
            data: {
                smiles: n.smiles,
                status: inStock ? 'in-stock' : 'default',
                inStock,
            },
        }
    })

    // Build React Flow edges
    const edges: Edge[] = layoutEdges.map((e, idx) => ({
        id: `${idPrefix}edge-${idx}`,
        source: e.source,
        target: e.target,
        animated: false,
        style: { stroke: '#94a3b8', strokeWidth: 2 },
    }))

    return { nodes, edges }
}

/**
 * Collects all InChiKeys from a route for batch stock checking.
 * InChiKeys are the canonical identifiers for molecules.
 */
export function getAllRouteInchiKeysSet(route: RouteVisualizationNode): Set<string> {
    const set = new Set<string>()
    collectInchiKeys(route, set)
    return set
}
