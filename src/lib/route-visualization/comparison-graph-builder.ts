/**
 * compatibility wrappers over @ischemist/routes comparison graph builders.
 */

/**
 * compatibility wrappers over @ischemist/routes comparison graph builders.
 */
import {
    buildDiffOverlayGraph as buildPackageDiffOverlayGraph,
    buildSideBySideGraph as buildPackageSideBySideGraph,
} from '@ischemist/routes/visualization'

import type { Edge, Node } from '@xyflow/react'

import type { BuyableMetadata, RouteGraphNode, RouteVisualizationNode } from '@/types'

type Graph = { nodes: Node<RouteGraphNode>[]; edges: Edge[] }

export function buildSideBySideGraph(
    route: RouteVisualizationNode,
    otherRoute: RouteVisualizationNode,
    _acceptableInchiKeys: Set<string>,
    _predInchiKeys: Set<string>,
    isAcceptableRoute: boolean,
    idPrefix: string,
    inStockInchiKeys?: Set<string>,
    buyableMetadataMap?: Map<string, BuyableMetadata>
): Graph {
    return buildPackageSideBySideGraph(
        route,
        otherRoute,
        isAcceptableRoute,
        idPrefix,
        inStockInchiKeys,
        buyableMetadataMap,
        isAcceptableRoute ? otherRoute : undefined
    ) as Graph
}

export function buildDiffOverlayGraph(
    acceptableRoute: RouteVisualizationNode,
    predRoute: RouteVisualizationNode,
    inStockInchiKeys?: Set<string>,
    buyableMetadataMap?: Map<string, BuyableMetadata>
): Graph {
    return buildPackageDiffOverlayGraph(acceptableRoute, predRoute, inStockInchiKeys, buyableMetadataMap) as Graph
}
