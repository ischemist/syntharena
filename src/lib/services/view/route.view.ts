/**
 * view model composition layer for route visualization.
 * rule: this file is FORBIDDEN from importing `prisma`.
 *
 * this module is concerned with the structure and visualization of a synthetic route,
 * regardless of its origin. it answers the question "how do I display this graph?".
 *
 * an acceptable route is not a prediction - its view logic lives here, not in prediction.view.ts.
 * prediction.view.ts is a consumer of this module for converting route trees to visualization format.
 */

import type {
    BenchmarkTargetWithMolecule,
    BuyableMetadata,
    ComparisonLayoutMode,
    ComparisonMode,
    PredictionRunSummary,
    Route,
    RouteNodeWithDetails,
    RouteVisualizationData,
    RouteVisualizationNode,
    TargetComparisonData,
} from '@/types'
import { COMPARISON_LAYOUT_MODES, COMPARISON_MODES } from '@/types'
import { getAllRouteInchiKeysSet } from '@/lib/route-visualization'
import { layoutTree } from '@/lib/route-visualization/layout'
import * as benchmarkData from '@/lib/services/data/benchmark.data'
import * as predictionData from '@/lib/services/data/prediction.data'
import * as routeData from '@/lib/services/data/route.data'
import * as stockData from '@/lib/services/data/stock.data'
import * as predictionView from '@/lib/services/view/prediction.view'
import { buildRouteTree } from '@/lib/tree-builder/route-tree'

// ============================================================================
// private helpers
// ============================================================================

/**
 * transforms a RouteNodeWithDetails tree into a lightweight RouteVisualizationNode format.
 * exported for use by prediction.view.ts and other consumers.
 */
export function toVisualizationNode(node: RouteNodeWithDetails): RouteVisualizationNode {
    return {
        smiles: node.molecule.smiles,
        inchikey: node.molecule.inchikey,
        children: node.children.length > 0 ? node.children.map(toVisualizationNode) : undefined,
    }
}

/** a pure, testable helper for calculating all navigation hrefs. */
function _buildComparisonNavigation(
    basePath: string,
    params: {
        mode?: string
        layout?: string
        devMode: boolean
        model1Id?: string
        model2Id?: string
        rank1: number
        rank2: number
        acceptableIndex: number
    },
    data: {
        totalAcceptableRoutes: number
        model1Run?: PredictionRunSummary
        model2Run?: PredictionRunSummary
    }
) {
    // this helper function generates a new URL search string, preserving existing
    // state while updating the one parameter being changed by the navigation action.
    const buildNavHref = (paramToChange: string, newValue: number) => {
        const search = new URLSearchParams()
        if (params.mode) search.set('mode', params.mode)
        if (params.layout) search.set('layout', params.layout)
        if (params.devMode) search.set('dev', 'true')
        if (params.model1Id) search.set('model1', params.model1Id)
        if (params.model2Id) search.set('model2', params.model2Id)
        search.set('rank1', params.rank1.toString())
        search.set('rank2', params.rank2.toString())
        search.set('acceptableIndex', params.acceptableIndex.toString())

        // override the specific param being changed
        search.set(paramToChange, newValue.toString())
        return `${basePath}?${search.toString()}`
    }

    // 1. acceptable route navigation state
    const acceptableRanks = Array.from({ length: data.totalAcceptableRoutes }, (_, i) => i)
    let prevAccHref = null
    let nextAccHref = null
    if (params.acceptableIndex > 0) {
        prevAccHref = buildNavHref('acceptableIndex', params.acceptableIndex - 1)
    }
    if (params.acceptableIndex < data.totalAcceptableRoutes - 1) {
        nextAccHref = buildNavHref('acceptableIndex', params.acceptableIndex + 1)
    }

    // 2. model 1 navigation state
    const model1AvailableRanks = data.model1Run?.availableRanks || []
    const model1CurrentIndex = model1AvailableRanks.indexOf(params.rank1)
    let prevM1Href = null
    let nextM1Href = null
    if (model1CurrentIndex > 0) {
        prevM1Href = buildNavHref('rank1', model1AvailableRanks[model1CurrentIndex - 1])
    }
    if (model1CurrentIndex < model1AvailableRanks.length - 1) {
        nextM1Href = buildNavHref('rank1', model1AvailableRanks[model1CurrentIndex + 1])
    }

    // 3. model 2 navigation state
    const model2AvailableRanks = data.model2Run?.availableRanks || []
    const model2CurrentIndex = model2AvailableRanks.indexOf(params.rank2)
    let prevM2Href = null
    let nextM2Href = null
    if (model2CurrentIndex > 0) {
        prevM2Href = buildNavHref('rank2', model2AvailableRanks[model2CurrentIndex - 1])
    }
    if (model2CurrentIndex < model2AvailableRanks.length - 1) {
        nextM2Href = buildNavHref('rank2', model2AvailableRanks[model2CurrentIndex + 1])
    }

    return {
        acceptableNav: {
            availableRanks: acceptableRanks,
            previousRankHref: prevAccHref,
            nextRankHref: nextAccHref,
        },
        model1Nav: {
            availableRanks: model1AvailableRanks,
            previousRankHref: prevM1Href,
            nextRankHref: nextM1Href,
        },
        model2Nav: {
            availableRanks: model2AvailableRanks,
            previousRankHref: prevM2Href,
            nextRankHref: nextM2Href,
        },
    }
}

// ============================================================================
// public view model orchestrators
// ============================================================================

/**
 * fetches acceptable routes for a target with route metadata.
 * thin wrapper over data layer, returns routes ordered by routeIndex.
 */
export async function getAcceptableRoutesForTarget(
    targetId: string
): Promise<Array<{ routeIndex: number; route: { id: string; contentHash: string | null; signature: string | null } }>> {
    const acceptableRoutes = await routeData.findAcceptableRoutesForTarget(targetId)
    return acceptableRoutes.map((ar) => ({
        routeIndex: ar.routeIndex,
        route: {
            id: ar.route.id,
            contentHash: ar.route.contentHash,
            signature: ar.route.signature,
        },
    }))
}

/**
 * fetches complete acceptable route data for visualization.
 * composes route metadata, target info, and full node tree.
 */
export async function getAcceptableRouteData(routeId: string, targetId: string): Promise<RouteVisualizationData> {
    // parallel fetch: route metadata, route nodes, and target data
    const [routeRecord, nodes, targetPayload] = await Promise.all([
        routeData.findRouteById(routeId),
        routeData.findNodesForRoute(routeId),
        benchmarkData.findTargetWithDetailsById(targetId),
    ])

    if (nodes.length === 0) {
        throw new Error('route has no nodes.')
    }

    // build hierarchical tree from flat nodes
    const rootNode = buildRouteTree(nodes)

    // construct target DTO
    const target: BenchmarkTargetWithMolecule = {
        id: targetPayload.id,
        benchmarkSetId: targetPayload.benchmarkSetId,
        targetId: targetPayload.targetId,
        moleculeId: targetPayload.moleculeId,
        routeLength: targetPayload.routeLength,
        isConvergent: targetPayload.isConvergent,
        metadata: targetPayload.metadata,
        molecule: targetPayload.molecule,
        hasAcceptableRoutes: targetPayload.acceptableRoutesCount > 0,
        acceptableRoutesCount: targetPayload.acceptableRoutesCount,
    }

    // construct route DTO from fetched route record
    const route: Route = {
        id: routeRecord.id,
        signature: routeRecord.signature,
        contentHash: routeRecord.contentHash,
        length: routeRecord.length,
        isConvergent: routeRecord.isConvergent,
    }

    return {
        route,
        target,
        rootNode,
    }
}

/**
 * fetches a route and builds its visualization tree.
 * returns lightweight RouteVisualizationNode format for client components.
 */
export async function getRouteTreeForVisualization(routeId: string): Promise<RouteVisualizationNode> {
    const nodes = await routeData.findNodesForRoute(routeId)

    if (nodes.length === 0) {
        throw new Error('route has no nodes.')
    }

    const tree = buildRouteTree(nodes)
    return toVisualizationNode(tree)
}

/**
 * fetches a route tree with pre-calculated layout positions.
 * performs all layout calculations server-side to minimize client-side work.
 * returns positioned nodes and edges ready for React Flow rendering.
 */
export async function getRouteTreeWithLayout(
    routeId: string,
    idPrefix: string
): Promise<{
    nodes: Array<{ id: string; smiles: string; inchikey: string; x: number; y: number }>
    edges: Array<{ source: string; target: string }>
}> {
    const tree = await getRouteTreeForVisualization(routeId)
    return layoutTree(tree, idPrefix)
}

/**
 * The "mega-dto" orchestrator for the target comparison page.
 * Fetches and composes ALL data needed for the complex comparison UI in parallel waves.
 */
export async function getTargetComparisonData(
    targetId: string,
    benchmarkId: string,
    modeProp?: string,
    model1Id?: string,
    model2Id?: string,
    rank1: number = 1,
    rank2: number = 1,
    layoutProp?: string,
    acceptableIndexProp: number = 0,
    devMode: boolean = false
): Promise<TargetComparisonData> {
    // --- Wave 1: Fetch base contextual data in parallel ---
    const [benchmark, availableRunsResult, acceptableRoutes] = await Promise.all([
        benchmarkData.findBenchmarkListItemById(benchmarkId),
        predictionView.getPredictionRunsForTarget(targetId, devMode),
        routeData.findAcceptableRoutesForTarget(targetId),
    ])

    // --- Process Wave 1 and Prepare for Wave 2 ---
    const totalAcceptableRoutes = acceptableRoutes.length
    const currentAcceptableIndex =
        totalAcceptableRoutes > 0 ? Math.min(Math.max(0, acceptableIndexProp), totalAcceptableRoutes - 1) : 0
    const selectedAcceptable = totalAcceptableRoutes > 0 ? acceptableRoutes[currentAcceptableIndex] : undefined

    // --- Wave 2: Fetch specific route data based on URL params ---
    const [acceptableRouteData, acceptableRouteLayout, model1Nodes, model2Nodes] = await Promise.all([
        selectedAcceptable ? getAcceptableRouteData(selectedAcceptable.route.id, targetId) : Promise.resolve(undefined),
        selectedAcceptable
            ? getRouteTreeWithLayout(selectedAcceptable.route.id, 'acceptable-route-')
            : Promise.resolve(undefined),
        model1Id ? predictionData.findPredictedRouteNodes(targetId, model1Id, rank1) : Promise.resolve(undefined),
        model2Id ? predictionData.findPredictedRouteNodes(targetId, model2Id, rank2) : Promise.resolve(undefined),
    ])

    // --- Process Wave 2: Build trees and Prepare for Wave 3 ---
    const acceptableRouteTree = acceptableRouteData ? toVisualizationNode(acceptableRouteData.rootNode) : undefined
    const model1RouteTree = model1Nodes ? toVisualizationNode(buildRouteTree(model1Nodes)) : undefined
    const model2RouteTree = model2Nodes ? toVisualizationNode(buildRouteTree(model2Nodes)) : undefined

    const allInchiKeys = new Set<string>()
    if (acceptableRouteTree) getAllRouteInchiKeysSet(acceptableRouteTree).forEach((key) => allInchiKeys.add(key))
    if (model1RouteTree) getAllRouteInchiKeysSet(model1RouteTree).forEach((key) => allInchiKeys.add(key))
    if (model2RouteTree) getAllRouteInchiKeysSet(model2RouteTree).forEach((key) => allInchiKeys.add(key))

    // --- Wave 3: Fetch all stock data in one shot ---
    let inStockInchiKeys = new Set<string>()
    let buyableMetadataMap = new Map<string, BuyableMetadata>()
    if (benchmark.stock && allInchiKeys.size > 0) {
        const stockItems = await stockData.findStockDataForInchiKeys(Array.from(allInchiKeys), benchmark.stock.id)
        const keys = new Set<string>()
        const meta = new Map<string, BuyableMetadata>()
        for (const item of stockItems) {
            keys.add(item.molecule.inchikey)
            meta.set(item.molecule.inchikey, item)
        }
        inStockInchiKeys = keys
        buyableMetadataMap = meta
    }

    // --- Final Assembly: Business logic and DTO construction ---
    const model1Run = availableRunsResult.find((run) => run.id === model1Id)
    const model2Run = availableRunsResult.find((run) => run.id === model2Id)

    // call the pure navigation logic helper
    const navState = _buildComparisonNavigation(
        `/benchmarks/${benchmarkId}/targets/${targetId}`,
        {
            mode: modeProp,
            layout: layoutProp,
            devMode,
            model1Id,
            model2Id,
            rank1,
            rank2,
            acceptableIndex: currentAcceptableIndex,
        },
        { totalAcceptableRoutes, model1Run, model2Run }
    )

    const currentMode =
        modeProp && (COMPARISON_MODES as readonly string[]).includes(modeProp)
            ? (modeProp as ComparisonMode)
            : acceptableRouteTree
              ? 'gt-only'
              : 'pred-vs-pred'

    const layout =
        layoutProp && (COMPARISON_LAYOUT_MODES as readonly string[]).includes(layoutProp)
            ? (layoutProp as ComparisonLayoutMode)
            : 'side-by-side'

    return {
        benchmarkId,
        targetId,
        availableRuns: availableRunsResult,
        acceptableRoute:
            acceptableRouteData && acceptableRouteTree
                ? {
                      route: acceptableRouteData.route,
                      data: acceptableRouteData,
                      visualizationNode: acceptableRouteTree,
                      layout: acceptableRouteLayout,
                      ...navState.acceptableNav,
                  }
                : undefined,
        totalAcceptableRoutes,
        currentAcceptableIndex,
        model1:
            model1Id && model1Run && model1RouteTree
                ? {
                      runId: model1Id,
                      rank: rank1,
                      name: `${model1Run.modelName} (${model1Run.algorithmName})`,
                      routeTree: model1RouteTree,
                      ...navState.model1Nav,
                  }
                : undefined,
        model2:
            model2Id && model2Run && model2RouteTree
                ? {
                      runId: model2Id,
                      rank: rank2,
                      name: `${model2Run.modelName} (${model2Run.algorithmName})`,
                      routeTree: model2RouteTree,
                      ...navState.model2Nav,
                  }
                : undefined,
        stockInfo: { inStockInchiKeys, buyableMetadataMap },
        currentMode,
        layout,
    }
}
