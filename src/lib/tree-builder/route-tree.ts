/**
 * utility for converting a flat array of route nodes into a hierarchical tree.
 * this is a pure function, stateless and without side effects.
 */

import type { RouteNodeWithDetails } from '@/types'
import type { RouteNodeWithMoleculePayload } from '@/lib/services/data/route.data.ts'

/**
 * builds a hierarchical route tree from a flat array of route nodes.
 *
 * @param nodes - flat array of route nodes with included molecule data from prisma.
 * @returns root node of the constructed tree.
 * @throws error if no root node is found or tree construction fails.
 */
export function buildRouteTree(nodes: RouteNodeWithMoleculePayload): RouteNodeWithDetails {
    if (nodes.length === 0) {
        throw new Error('cannot build tree from an empty array of nodes.')
    }

    const rootNodeData = nodes.find((n) => n.parentId === null)
    if (!rootNodeData) {
        throw new Error('no root node found in route nodes.')
    }

    const nodeMap = new Map<string, RouteNodeWithDetails>()

    // first pass: create all nodes with empty children arrays.
    nodes.forEach((node) => {
        nodeMap.set(node.id, {
            ...node,
            children: [],
        })
    })

    // second pass: build parent-child relationships.
    nodes.forEach((node) => {
        if (node.parentId) {
            const parent = nodeMap.get(node.parentId)
            const child = nodeMap.get(node.id)
            if (parent && child) {
                parent.children.push(child)
            }
        }
    })

    const routeTree = nodeMap.get(rootNodeData.id)
    if (!routeTree) {
        throw new Error('failed to build route tree from nodes.')
    }

    return routeTree
}
