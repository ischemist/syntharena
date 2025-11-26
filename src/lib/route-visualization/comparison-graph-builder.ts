/**
 * Graph builders for route comparison visualizations.
 * Supports side-by-side and diff overlay views.
 */

import type { Edge, Node } from '@xyflow/react'

import type { MergedRouteNode, NodeStatus, RouteGraphNode, RouteVisualizationNode } from '@/types'

import { assignPositions, calculateSubtreeWidth, collectInchiKeys, layoutTree } from './layout'

/**
 * Internal layout node with status for merged trees.
 */
interface LayoutNodeWithStatus {
    id: string
    smiles: string
    inchikey: string
    status: NodeStatus
    children: LayoutNodeWithStatus[]
    width?: number
    x?: number
    y?: number
}

/**
 * Builds side-by-side graph for a route with comparison status.
 * Used for both ground truth and prediction in side-by-side view.
 *
 * For ground truth: shows all GT nodes as "match"
 * For prediction: shows predicted nodes (match/extension) + ghost nodes from GT
 *
 * @param route - Route to visualize
 * @param otherRoute - The other route for comparison (GT when building pred, pred when building GT)
 * @param gtInchiKeys - Set of InChiKeys from ground truth
 * @param predInchiKeys - Set of InChiKeys from prediction
 * @param isGT - Whether this is the ground truth route (true) or prediction (false)
 * @param idPrefix - Prefix for node IDs
 * @param inStockInchiKeys - Set of InChiKeys that are in stock (optional)
 * @returns React Flow nodes and edges with comparison status
 */
export function buildSideBySideGraph(
    route: RouteVisualizationNode,
    otherRoute: RouteVisualizationNode,
    gtInchiKeys: Set<string>,
    predInchiKeys: Set<string>,
    isGT: boolean,
    idPrefix: string,
    inStockInchiKeys?: Set<string>
): { nodes: Node<RouteGraphNode>[]; edges: Edge[] } {
    if (isGT) {
        // Ground truth side: just show the GT route with all nodes as "match"
        const { nodes: layoutNodes, edges: layoutEdges } = layoutTree(route, idPrefix)

        const nodes: Node<RouteGraphNode>[] = layoutNodes.map((n) => ({
            id: n.id,
            type: 'molecule',
            position: { x: n.x, y: n.y },
            data: {
                smiles: n.smiles,
                status: 'match' as NodeStatus,
            },
        }))

        const edges: Edge[] = layoutEdges.map((e, idx) => ({
            id: `${idPrefix}edge-${idx}`,
            source: e.source,
            target: e.target,
            animated: false,
            style: { stroke: '#94a3b8', strokeWidth: 2 },
        }))

        return { nodes, edges }
    } else {
        // Prediction side: merge with GT to show ghost nodes
        const mergedTree = mergeTreesForDiff(otherRoute, route, gtInchiKeys, predInchiKeys)
        if (!mergedTree) return { nodes: [], edges: [] }

        const layoutRoot = buildMergedLayoutTree(mergedTree, idPrefix)
        calculateSubtreeWidth(layoutRoot)
        assignPositions(layoutRoot, 0, 0)

        const layoutNodes: Array<{
            id: string
            smiles: string
            inchikey: string
            x: number
            y: number
            status: NodeStatus
            isLeaf: boolean
        }> = []
        const layoutEdges: Array<{ source: string; target: string; isGhost: boolean }> = []
        flattenMergedLayoutTree(layoutRoot, layoutNodes, layoutEdges, null, false)

        const nodes: Node<RouteGraphNode>[] = layoutNodes.map((n) => ({
            id: n.id,
            type: 'molecule',
            position: { x: n.x, y: n.y },
            data: {
                smiles: n.smiles,
                status: n.status,
                isLeaf: n.isLeaf,
                inStock: inStockInchiKeys?.has(n.inchikey),
            },
        }))

        const edges: Edge[] = layoutEdges.map((e, idx) => ({
            id: `${idPrefix}edge-${idx}`,
            source: e.source,
            target: e.target,
            animated: false,
            style: e.isGhost
                ? { stroke: '#9ca3af', strokeWidth: 2, strokeDasharray: '5,5' }
                : { stroke: '#94a3b8', strokeWidth: 2 },
        }))

        return { nodes, edges }
    }
}

/**
 * Merges ground truth and prediction trees for diff overlay.
 * Creates a unified tree with status annotations.
 *
 * @param gtNode - Ground truth node (can be null)
 * @param predNode - Prediction node (can be null)
 * @param gtInchiKeys - Set of all InChiKeys in ground truth
 * @param predInchiKeys - Set of all InChiKeys in prediction
 * @returns Merged tree with status for each node
 */
function mergeTreesForDiff(
    gtNode: RouteVisualizationNode | null,
    predNode: RouteVisualizationNode | null,
    gtInchiKeys: Set<string>,
    predInchiKeys: Set<string>
): MergedRouteNode | null {
    if (!gtNode && !predNode) return null

    // Use prediction node if available, otherwise ground truth
    const smiles = predNode?.smiles || gtNode!.smiles
    const inchikey = predNode?.inchikey || gtNode!.inchikey
    let status: NodeStatus

    if (predInchiKeys.has(inchikey) && gtInchiKeys.has(inchikey)) {
        status = 'match'
    } else if (predInchiKeys.has(inchikey) && !gtInchiKeys.has(inchikey)) {
        status = 'extension'
    } else {
        status = 'ghost'
    }

    // Merge children by InChiKey
    const gtChildren = gtNode?.children || []
    const predChildren = predNode?.children || []
    const mergedChildrenMap = new Map<string, MergedRouteNode>()

    // Add all prediction children first
    predChildren.forEach((child) => {
        const gtMatch = gtChildren.find((gc) => gc.inchikey === child.inchikey)
        const merged = mergeTreesForDiff(gtMatch || null, child, gtInchiKeys, predInchiKeys)
        if (merged) {
            mergedChildrenMap.set(child.inchikey, merged)
        }
    })

    // Add GT children that are missing from prediction
    gtChildren.forEach((child) => {
        if (!mergedChildrenMap.has(child.inchikey)) {
            const merged = mergeTreesForDiff(child, null, gtInchiKeys, predInchiKeys)
            if (merged) {
                mergedChildrenMap.set(child.inchikey, merged)
            }
        }
    })

    return {
        smiles,
        inchikey,
        status,
        children: Array.from(mergedChildrenMap.values()),
    }
}

/**
 * Builds layout tree from merged node with status.
 */
function buildMergedLayoutTree(node: MergedRouteNode, idPrefix: string): LayoutNodeWithStatus {
    const nodeId = `${idPrefix}${node.smiles}`
    return {
        id: nodeId,
        smiles: node.smiles,
        inchikey: node.inchikey,
        status: node.status,
        children: node.children.map((child) => buildMergedLayoutTree(child, idPrefix)),
    }
}

/**
 * Flattens merged layout tree with status information.
 */
function flattenMergedLayoutTree(
    node: LayoutNodeWithStatus,
    nodes: Array<{
        id: string
        smiles: string
        inchikey: string
        x: number
        y: number
        status: NodeStatus
        isLeaf: boolean
    }>,
    edges: Array<{ source: string; target: string; isGhost: boolean }>,
    parentId: string | null,
    parentIsGhost: boolean
): void {
    const isGhost = node.status === 'ghost'
    const isLeaf = node.children.length === 0
    nodes.push({
        id: node.id,
        smiles: node.smiles,
        inchikey: node.inchikey,
        x: node.x!,
        y: node.y!,
        status: node.status,
        isLeaf,
    })

    if (parentId) {
        edges.push({ source: parentId, target: node.id, isGhost: isGhost || parentIsGhost })
    }

    node.children.forEach((child) => {
        flattenMergedLayoutTree(child, nodes, edges, node.id, isGhost)
    })
}

/**
 * Builds diff overlay graph showing merged prediction and ground truth.
 * Highlights matches, extensions, and missing nodes.
 *
 * @param gtRoute - Ground truth route
 * @param predRoute - Predicted route
 * @param inStockInchiKeys - Set of InChiKeys that are in stock (optional)
 * @returns React Flow nodes and edges with diff highlighting
 */
export function buildDiffOverlayGraph(
    gtRoute: RouteVisualizationNode,
    predRoute: RouteVisualizationNode,
    inStockInchiKeys?: Set<string>
): { nodes: Node<RouteGraphNode>[]; edges: Edge[] } {
    // Collect all InChiKeys from both trees
    const gtInchiKeys = new Set<string>()
    const predInchiKeys = new Set<string>()
    collectInchiKeys(gtRoute, gtInchiKeys)
    collectInchiKeys(predRoute, predInchiKeys)

    // Merge trees
    const mergedTree = mergeTreesForDiff(gtRoute, predRoute, gtInchiKeys, predInchiKeys)
    if (!mergedTree) return { nodes: [], edges: [] }

    // Build layout tree with status
    const layoutRoot = buildMergedLayoutTree(mergedTree, 'diff_')
    calculateSubtreeWidth(layoutRoot)
    assignPositions(layoutRoot, 0, 0)

    // Flatten to nodes and edges
    const layoutNodes: Array<{
        id: string
        smiles: string
        inchikey: string
        x: number
        y: number
        status: NodeStatus
        isLeaf: boolean
    }> = []
    const layoutEdges: Array<{ source: string; target: string; isGhost: boolean }> = []
    flattenMergedLayoutTree(layoutRoot, layoutNodes, layoutEdges, null, false)

    // Build React Flow nodes
    const nodes: Node<RouteGraphNode>[] = layoutNodes.map((n) => ({
        id: n.id,
        type: 'molecule',
        position: { x: n.x, y: n.y },
        data: {
            smiles: n.smiles,
            status: n.status,
            isLeaf: n.isLeaf,
            inStock: inStockInchiKeys?.has(n.inchikey),
        },
    }))

    // Build React Flow edges with ghost styling
    const edges: Edge[] = layoutEdges.map((e, idx) => ({
        id: `diff-edge-${idx}`,
        source: e.source,
        target: e.target,
        animated: false,
        style: e.isGhost
            ? { stroke: '#9ca3af', strokeWidth: 2, strokeDasharray: '5,5' }
            : { stroke: '#94a3b8', strokeWidth: 2 },
    }))

    return { nodes, edges }
}
