/**
 * Transforms route tree into React Flow nodes and edges.
 * Handles single route visualization with stock availability.
 */

import type { Edge, Node } from '@xyflow/react'

import type { RouteGraphNode, RouteVisualizationNode } from '@/types'

import { collectSmiles, layoutTree } from './layout'

/**
 * Builds React Flow graph from a visualization tree.
 * Integrates layout positioning and stock availability.
 */
export function buildRouteGraph(
    route: RouteVisualizationNode,
    inStockSmiles: Set<string>,
    idPrefix: string
): { nodes: Node<RouteGraphNode>[]; edges: Edge[] } {
    // Get layout positions
    const { nodes: layoutNodes, edges: layoutEdges } = layoutTree(route, idPrefix)

    // Build React Flow nodes with status
    const nodes: Node<RouteGraphNode>[] = layoutNodes.map((n) => {
        const inStock = inStockSmiles.has(n.smiles)
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
 * Collects all SMILES from a route for batch stock checking.
 */
export function getAllRouteSmilesSet(route: RouteVisualizationNode): Set<string> {
    const set = new Set<string>()
    collectSmiles(route, set)
    return set
}
