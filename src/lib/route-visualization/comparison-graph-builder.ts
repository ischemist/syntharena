/**
 * compatibility wrappers over @ischemist/routes comparison graph builders.
 */

import type { Edge, Node } from '@xyflow/react'
import {
    buildDiffOverlayGraph as buildPackageDiffOverlayGraph,
    buildPredictionDiffOverlayGraph as buildPackagePredictionDiffOverlayGraph,
    buildPredictionSideBySideGraph as buildPackagePredictionSideBySideGraph,
    buildSideBySideGraph as buildPackageSideBySideGraph,
} from '@ischemist/routes/visualization'

import type { BuyableMetadata, RouteGraphNode, RouteVisualizationNode } from '@/types'

type Graph = { nodes: Node<RouteGraphNode>[]; edges: Edge[] }

export function buildSideBySideGraph(
    route: RouteVisualizationNode,
    otherRoute: RouteVisualizationNode,
    acceptableInchiKeys: Set<string>,
    _predInchiKeys: Set<string>,
    isAcceptableRoute: boolean,
    idPrefix: string,
    inStockInchiKeys?: Set<string>,
    buyableMetadataMap?: Map<string, BuyableMetadata>
): Graph {
    return buildPackageSideBySideGraph(
        route,
        isAcceptableRoute ? route : otherRoute || acceptableInchiKeys,
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

export function buildPredictionSideBySideGraph(
    route: RouteVisualizationNode,
    _otherRoute: RouteVisualizationNode,
    pred1InchiKeys: Set<string>,
    pred2InchiKeys: Set<string>,
    isFirstRoute: boolean,
    idPrefix: string,
    inStockInchiKeys?: Set<string>,
    buyableMetadataMap?: Map<string, BuyableMetadata>
): Graph {
    return buildPackagePredictionSideBySideGraph(
        route,
        isFirstRoute ? pred2InchiKeys : pred1InchiKeys,
        isFirstRoute,
        idPrefix,
        inStockInchiKeys,
        buyableMetadataMap
    ) as Graph
}

export function buildPredictionDiffOverlayGraph(
    pred1Route: RouteVisualizationNode,
    pred2Route: RouteVisualizationNode,
    inStockInchiKeys?: Set<string>,
    buyableMetadataMap?: Map<string, BuyableMetadata>
): Graph {
    return buildPackagePredictionDiffOverlayGraph(pred1Route, pred2Route, inStockInchiKeys, buyableMetadataMap) as Graph
}
