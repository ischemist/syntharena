/**
 * Route Tree Builder - Utility for converting flat route nodes to hierarchical trees
 *
 * Provides reusable logic for building route tree structures from flat arrays of route nodes.
 * Used by prediction service and UI components to construct RouteNodeWithDetails trees.
 */

import type { Molecule, RouteNode } from '@prisma/client'

import type { RouteNodeWithDetails } from '@/types'

/**
 * Input type for route nodes with included molecule data.
 * Matches the Prisma query result structure.
 */
type RouteNodeWithMolecule = RouteNode & {
    molecule: Molecule
}

/**
 * Builds a hierarchical route tree from a flat array of route nodes.
 *
 * This function:
 * 1. Finds the root node (node with no parent)
 * 2. Creates a map of all nodes by ID for O(1) lookups
 * 3. Builds parent-child relationships by connecting nodes via parentId
 *
 * @param nodes - Flat array of route nodes with included molecule data
 * @returns Root node of the constructed tree with full hierarchy
 * @throws Error if no root node is found or tree construction fails
 *
 * @example
 * ```ts
 * const nodes = await prisma.routeNode.findMany({
 *   where: { routeId },
 *   include: { molecule: true }
 * })
 * const tree = buildRouteTree(nodes)
 * ```
 */
export function buildRouteTree(nodes: RouteNodeWithMolecule[]): RouteNodeWithDetails {
    // Find root node (node with no parent)
    const rootNode = nodes.find((n) => n.parentId === null)
    if (!rootNode) {
        throw new Error('No root node found in route nodes.')
    }

    // Build a map of nodes by ID for O(1) lookups
    const nodeMap = new Map<string, RouteNodeWithDetails>()

    // First pass: create all nodes with empty children arrays
    nodes.forEach((node) => {
        nodeMap.set(node.id, {
            ...node,
            molecule: node.molecule,
            children: [],
        })
    })

    // Second pass: build parent-child relationships
    nodes.forEach((node) => {
        if (node.parentId) {
            const parent = nodeMap.get(node.parentId)
            const child = nodeMap.get(node.id)
            if (parent && child) {
                parent.children.push(child)
            }
        }
    })

    const routeTree = nodeMap.get(rootNode.id)
    if (!routeTree) {
        throw new Error('Failed to build route tree from nodes.')
    }

    return routeTree
}
