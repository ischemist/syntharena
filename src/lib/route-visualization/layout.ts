/**
 * Tree layout algorithm for route visualization.
 * Calculates positions for nodes to create a readable tree layout.
 */

import type { RouteVisualizationNode } from '@/types'

import { HORIZONTAL_SPACING, NODE_HEIGHT, NODE_WIDTH, VERTICAL_SPACING } from './constants'

/**
 * Internal layout node structure with width and position calculations.
 */
interface LayoutNode {
    id: string
    smiles: string
    inchikey: string
    children: LayoutNode[]
    width?: number
    x?: number
    y?: number
}

/**
 * Builds a layout tree from visualization tree.
 * Assigns IDs and initializes structure.
 */
export function buildLayoutTree(node: RouteVisualizationNode, idPrefix: string): LayoutNode {
    const nodeId = `${idPrefix}${node.smiles}`
    return {
        id: nodeId,
        smiles: node.smiles,
        inchikey: node.inchikey,
        children: (node.children || []).map((child, index) => buildLayoutTree(child, `${nodeId}-${index}-`)),
    }
}

/**
 * Calculates the width required for each subtree.
 * Assigns width to each node based on its children.
 */
export function calculateSubtreeWidth(node: LayoutNode): number {
    if (node.children.length === 0) {
        node.width = NODE_WIDTH
        return NODE_WIDTH
    }

    const childrenWidth = node.children.reduce((sum, child) => {
        return sum + calculateSubtreeWidth(child)
    }, 0)

    const totalChildrenWidth = childrenWidth + (node.children.length - 1) * HORIZONTAL_SPACING
    node.width = Math.max(NODE_WIDTH, totalChildrenWidth)
    return node.width
}

/**
 * Assigns x,y coordinates to each node in the tree.
 * Uses top-down, left-to-right layout.
 */
export function assignPositions(node: LayoutNode, x: number, y: number): void {
    // Center node within its allocated width
    node.x = x + (node.width! - NODE_WIDTH) / 2
    node.y = y

    if (node.children.length === 0) return

    // Recursively position children left-to-right
    let currentX = x
    node.children.forEach((child) => {
        assignPositions(child, currentX, y + NODE_HEIGHT + VERTICAL_SPACING)
        currentX += child.width! + HORIZONTAL_SPACING
    })
}

/**
 * Flattens the positioned tree into arrays of nodes and edges.
 */
export function flattenLayoutTree(
    node: LayoutNode,
    nodes: Array<{ id: string; smiles: string; inchikey: string; x: number; y: number }>,
    edges: Array<{ source: string; target: string }>,
    parentId: string | null
): void {
    nodes.push({ id: node.id, smiles: node.smiles, inchikey: node.inchikey, x: node.x!, y: node.y! })

    if (parentId) {
        edges.push({ source: parentId, target: node.id })
    }

    node.children.forEach((child) => {
        flattenLayoutTree(child, nodes, edges, node.id)
    })
}

/**
 * Complete layout pipeline.
 * Takes a visualization tree and returns positioned nodes and edges.
 */
export function layoutTree(
    root: RouteVisualizationNode,
    idPrefix: string
): {
    nodes: Array<{ id: string; smiles: string; inchikey: string; x: number; y: number }>
    edges: Array<{ source: string; target: string }>
} {
    const layoutRoot = buildLayoutTree(root, idPrefix)
    calculateSubtreeWidth(layoutRoot)
    assignPositions(layoutRoot, 0, 0)

    const nodes: Array<{ id: string; smiles: string; inchikey: string; x: number; y: number }> = []
    const edges: Array<{ source: string; target: string }> = []
    flattenLayoutTree(layoutRoot, nodes, edges, null)

    return { nodes, edges }
}

/**
 * Collects all SMILES from a tree into a Set.
 * Useful for stock availability checking.
 * @deprecated Use collectInchiKeys instead for reliable molecule comparison
 */
export function collectSmiles(node: RouteVisualizationNode, set: Set<string>): void {
    set.add(node.smiles)
    if (node.children) {
        node.children.forEach((child) => collectSmiles(child, set))
    }
}

/**
 * Collects all InChiKeys from a tree into a Set.
 * InChiKeys are canonical identifiers for reliable molecule comparison.
 */
export function collectInchiKeys(node: RouteVisualizationNode, set: Set<string>): void {
    set.add(node.inchikey)
    if (node.children) {
        node.children.forEach((child) => collectInchiKeys(child, set))
    }
}
