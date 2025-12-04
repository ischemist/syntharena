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
 * Used for both acceptable route and prediction in side-by-side view.
 *
 * For acceptable route: shows all acceptable route nodes as "match" with stock availability
 * For prediction: shows predicted nodes (match/extension) with stock availability on leaf nodes
 *
 * @param route - Route to visualize
 * @param otherRoute - The other route for comparison (acceptable when building pred, pred when building acceptable)
 * @param acceptableInchiKeys - Set of InChiKeys from acceptable route
 * @param predInchiKeys - Set of InChiKeys from prediction
 * @param isAcceptableRoute - Whether this is the acceptable route (true) or prediction (false)
 * @param idPrefix - Prefix for node IDs
 * @param inStockInchiKeys - Set of InChiKeys that are in stock (optional)
 * @returns React Flow nodes and edges with comparison status
 */
export function buildSideBySideGraph(
    route: RouteVisualizationNode,
    otherRoute: RouteVisualizationNode,
    acceptableInchiKeys: Set<string>,
    predInchiKeys: Set<string>,
    isAcceptableRoute: boolean,
    idPrefix: string,
    inStockInchiKeys?: Set<string>
): { nodes: Node<RouteGraphNode>[]; edges: Edge[] } {
    if (isAcceptableRoute) {
        // Acceptable route side: show the acceptable route with all nodes as "match" and stock info on leaf nodes
        const { nodes: layoutNodes, edges: layoutEdges } = layoutTree(route, idPrefix)

        // Build a set to track which nodes are leaf nodes (no children in the tree)
        const leafNodeIds = new Set<string>()
        const nodeChildren = new Map<string, number>()
        layoutEdges.forEach((edge) => {
            nodeChildren.set(edge.source, (nodeChildren.get(edge.source) || 0) + 1)
        })
        layoutNodes.forEach((node) => {
            if (!nodeChildren.has(node.id)) {
                leafNodeIds.add(node.id)
            }
        })

        const nodes: Node<RouteGraphNode>[] = layoutNodes.map((n) => ({
            id: n.id,
            type: 'molecule',
            position: { x: n.x, y: n.y },
            data: {
                smiles: n.smiles,
                status: 'match' as NodeStatus,
                isLeaf: leafNodeIds.has(n.id),
                inStock: inStockInchiKeys?.has(n.inchikey),
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
        // Prediction side: show only prediction nodes with stock info on leaf nodes
        const { nodes: layoutNodes, edges: layoutEdges } = layoutTree(route, idPrefix)

        // Build a set to track which nodes are leaf nodes (no children in the tree)
        const leafNodeIds = new Set<string>()
        const nodeChildren = new Map<string, number>()
        layoutEdges.forEach((edge) => {
            nodeChildren.set(edge.source, (nodeChildren.get(edge.source) || 0) + 1)
        })
        layoutNodes.forEach((node) => {
            if (!nodeChildren.has(node.id)) {
                leafNodeIds.add(node.id)
            }
        })

        const nodes: Node<RouteGraphNode>[] = layoutNodes.map((n) => {
            // Determine status based on whether it's in acceptable route
            const status: NodeStatus = acceptableInchiKeys.has(n.inchikey) ? 'match' : 'extension'
            return {
                id: n.id,
                type: 'molecule',
                position: { x: n.x, y: n.y },
                data: {
                    smiles: n.smiles,
                    status,
                    isLeaf: leafNodeIds.has(n.id),
                    inStock: inStockInchiKeys?.has(n.inchikey),
                },
            }
        })

        const edges: Edge[] = layoutEdges.map((e, idx) => ({
            id: `${idPrefix}edge-${idx}`,
            source: e.source,
            target: e.target,
            animated: false,
            style: { stroke: '#94a3b8', strokeWidth: 2 },
        }))

        return { nodes, edges }
    }
}

/**
 * Merges acceptable route and prediction trees for diff overlay.
 * Creates a unified tree with status annotations.
 *
 * @param acceptableNode - Acceptable route node (can be null)
 * @param predNode - Prediction node (can be null)
 * @param acceptableInchiKeys - Set of all InChiKeys in acceptable route
 * @param predInchiKeys - Set of all InChiKeys in prediction
 * @returns Merged tree with status for each node
 */
function mergeTreesForDiff(
    acceptableNode: RouteVisualizationNode | null,
    predNode: RouteVisualizationNode | null,
    acceptableInchiKeys: Set<string>,
    predInchiKeys: Set<string>
): MergedRouteNode | null {
    if (!acceptableNode && !predNode) return null

    // Use prediction node if available, otherwise acceptable route
    const smiles = predNode?.smiles || acceptableNode!.smiles
    const inchikey = predNode?.inchikey || acceptableNode!.inchikey
    let status: NodeStatus

    if (predInchiKeys.has(inchikey) && acceptableInchiKeys.has(inchikey)) {
        status = 'match'
    } else if (predInchiKeys.has(inchikey) && !acceptableInchiKeys.has(inchikey)) {
        status = 'extension'
    } else {
        status = 'ghost'
    }

    // Merge children by InChiKey
    const acceptableChildren = acceptableNode?.children || []
    const predChildren = predNode?.children || []
    const mergedChildrenMap = new Map<string, MergedRouteNode>()

    // Add all prediction children first
    predChildren.forEach((child) => {
        const acceptableMatch = acceptableChildren.find((ac) => ac.inchikey === child.inchikey)
        const merged = mergeTreesForDiff(acceptableMatch || null, child, acceptableInchiKeys, predInchiKeys)
        if (merged) {
            mergedChildrenMap.set(child.inchikey, merged)
        }
    })

    // Add acceptable route children that are missing from prediction
    acceptableChildren.forEach((child) => {
        if (!mergedChildrenMap.has(child.inchikey)) {
            const merged = mergeTreesForDiff(child, null, acceptableInchiKeys, predInchiKeys)
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
    // Dashed edges for:
    // - 'ghost' status (missing from prediction in acceptable vs pred mode)
    // - 'pred-2-only' status (unique to Model 2 in pred-vs-pred mode)
    const isDashed = node.status === 'ghost' || node.status === 'pred-2-only'
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
        edges.push({ source: parentId, target: node.id, isGhost: isDashed || parentIsGhost })
    }

    node.children.forEach((child) => {
        flattenMergedLayoutTree(child, nodes, edges, node.id, isDashed)
    })
}

/**
 * Builds diff overlay graph showing merged prediction and acceptable route.
 * Highlights matches, extensions, and missing nodes.
 *
 * @param acceptableRoute - Acceptable route
 * @param predRoute - Predicted route
 * @param inStockInchiKeys - Set of InChiKeys that are in stock (optional)
 * @returns React Flow nodes and edges with diff highlighting
 */
export function buildDiffOverlayGraph(
    acceptableRoute: RouteVisualizationNode,
    predRoute: RouteVisualizationNode,
    inStockInchiKeys?: Set<string>
): { nodes: Node<RouteGraphNode>[]; edges: Edge[] } {
    // Collect all InChiKeys from both trees
    const acceptableInchiKeys = new Set<string>()
    const predInchiKeys = new Set<string>()
    collectInchiKeys(acceptableRoute, acceptableInchiKeys)
    collectInchiKeys(predRoute, predInchiKeys)

    // Merge trees
    const mergedTree = mergeTreesForDiff(acceptableRoute, predRoute, acceptableInchiKeys, predInchiKeys)
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

/**
 * Builds side-by-side graph for prediction-vs-prediction comparison.
 * Both routes are treated as predictions with stock badges on leaf nodes.
 *
 * @param route - Route to visualize
 * @param otherRoute - The other route for comparison
 * @param pred1InchiKeys - Set of InChiKeys from prediction 1
 * @param pred2InchiKeys - Set of InChiKeys from prediction 2
 * @param isFirstRoute - Whether this is the first route (true) or second (false)
 * @param idPrefix - Prefix for node IDs
 * @param inStockInchiKeys - Set of InChiKeys that are in stock (optional)
 * @returns React Flow nodes and edges with comparison status
 */
export function buildPredictionSideBySideGraph(
    route: RouteVisualizationNode,
    otherRoute: RouteVisualizationNode,
    pred1InchiKeys: Set<string>,
    pred2InchiKeys: Set<string>,
    isFirstRoute: boolean,
    idPrefix: string,
    inStockInchiKeys?: Set<string>
): { nodes: Node<RouteGraphNode>[]; edges: Edge[] } {
    const { nodes: layoutNodes, edges: layoutEdges } = layoutTree(route, idPrefix)

    // Build a set to track which nodes are leaf nodes (no children in the tree)
    const leafNodeIds = new Set<string>()
    const nodeChildren = new Map<string, number>()
    layoutEdges.forEach((edge) => {
        nodeChildren.set(edge.source, (nodeChildren.get(edge.source) || 0) + 1)
    })
    layoutNodes.forEach((node) => {
        if (!nodeChildren.has(node.id)) {
            leafNodeIds.add(node.id)
        }
    })

    // Determine which InChiKey set to use for comparison (the other route)
    const otherRouteKeys = isFirstRoute ? pred2InchiKeys : pred1InchiKeys

    const nodes: Node<RouteGraphNode>[] = layoutNodes.map((n) => {
        // Determine status based on whether it's in the other route
        // Use pred-specific statuses: pred-shared, pred-1-only, pred-2-only
        let status: NodeStatus
        if (otherRouteKeys.has(n.inchikey)) {
            status = 'pred-shared'
        } else {
            status = isFirstRoute ? 'pred-1-only' : 'pred-2-only'
        }
        return {
            id: n.id,
            type: 'molecule',
            position: { x: n.x, y: n.y },
            data: {
                smiles: n.smiles,
                status,
                isLeaf: leafNodeIds.has(n.id),
                inStock: inStockInchiKeys?.has(n.inchikey),
            },
        }
    })

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
 * Merges two prediction trees for diff overlay with prediction-specific statuses.
 * Similar to mergeTreesForDiff but uses pred-shared/pred-1-only/pred-2-only statuses.
 */
function mergeTreesForPredDiff(
    pred1Node: RouteVisualizationNode | null,
    pred2Node: RouteVisualizationNode | null,
    pred1InchiKeys: Set<string>,
    pred2InchiKeys: Set<string>
): MergedRouteNode | null {
    if (!pred1Node && !pred2Node) return null

    // Use pred1 node if available, otherwise pred2
    const smiles = pred1Node?.smiles || pred2Node!.smiles
    const inchikey = pred1Node?.inchikey || pred2Node!.inchikey
    let status: NodeStatus

    // Use prediction-specific statuses
    if (pred1InchiKeys.has(inchikey) && pred2InchiKeys.has(inchikey)) {
        status = 'pred-shared'
    } else if (pred1InchiKeys.has(inchikey) && !pred2InchiKeys.has(inchikey)) {
        status = 'pred-1-only'
    } else {
        status = 'pred-2-only'
    }

    // Merge children by InChiKey
    const pred1Children = pred1Node?.children || []
    const pred2Children = pred2Node?.children || []
    const mergedChildrenMap = new Map<string, MergedRouteNode>()

    // Add all pred1 children first
    pred1Children.forEach((child) => {
        const pred2Match = pred2Children.find((pc) => pc.inchikey === child.inchikey)
        const merged = mergeTreesForPredDiff(child, pred2Match || null, pred1InchiKeys, pred2InchiKeys)
        if (merged) {
            mergedChildrenMap.set(child.inchikey, merged)
        }
    })

    // Add pred2 children that are missing from pred1
    pred2Children.forEach((child) => {
        if (!mergedChildrenMap.has(child.inchikey)) {
            const merged = mergeTreesForPredDiff(null, child, pred1InchiKeys, pred2InchiKeys)
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
 * Builds diff overlay graph for prediction-vs-prediction comparison.
 * Shows merged view with differences highlighted. Both routes are predictions.
 *
 * @param pred1Route - First prediction route
 * @param pred2Route - Second prediction route
 * @param inStockInchiKeys - Set of InChiKeys that are in stock (optional)
 * @returns React Flow nodes and edges with diff highlighting
 */
export function buildPredictionDiffOverlayGraph(
    pred1Route: RouteVisualizationNode,
    pred2Route: RouteVisualizationNode,
    inStockInchiKeys?: Set<string>
): { nodes: Node<RouteGraphNode>[]; edges: Edge[] } {
    // Collect all InChiKeys from both trees
    const pred1InchiKeys = new Set<string>()
    const pred2InchiKeys = new Set<string>()
    collectInchiKeys(pred1Route, pred1InchiKeys)
    collectInchiKeys(pred2Route, pred2InchiKeys)

    // Merge trees using prediction-specific statuses
    const mergedTree = mergeTreesForPredDiff(pred1Route, pred2Route, pred1InchiKeys, pred2InchiKeys)
    if (!mergedTree) return { nodes: [], edges: [] }

    // Build layout tree with status
    const layoutRoot = buildMergedLayoutTree(mergedTree, 'diff_pred_')
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
        id: `diff-pred-edge-${idx}`,
        source: e.source,
        target: e.target,
        animated: false,
        style: e.isGhost
            ? { stroke: '#9ca3af', strokeWidth: 2, strokeDasharray: '5,5' }
            : { stroke: '#94a3b8', strokeWidth: 2 },
    }))

    return { nodes, edges }
}
