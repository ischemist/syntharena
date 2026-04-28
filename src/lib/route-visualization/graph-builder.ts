/**
 * compatibility wrappers over @ischemist/routes graph builders.
 */

import type { Edge, Node } from '@xyflow/react'
import {
    buildRouteGraph as buildPackageRouteGraph,
    getAllRouteInchiKeysSet as getPackageAllRouteInchiKeysSet,
} from '@ischemist/routes/visualization'

import type { BuyableMetadata, RouteGraphNode, RouteVisualizationNode } from '@/types'

export function buildRouteGraph(
    route: RouteVisualizationNode,
    inStockInchiKeys: Set<string>,
    idPrefix: string,
    buyableMetadataMap?: Map<string, BuyableMetadata>
): { nodes: Node<RouteGraphNode>[]; edges: Edge[] } {
    return buildPackageRouteGraph(route, inStockInchiKeys, idPrefix, buyableMetadataMap) as {
        nodes: Node<RouteGraphNode>[]
        edges: Edge[]
    }
}

export function getAllRouteInchiKeysSet(route: RouteVisualizationNode): Set<string> {
    return getPackageAllRouteInchiKeysSet(route)
}
