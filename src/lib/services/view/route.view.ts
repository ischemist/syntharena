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
    Route,
    RouteNodeWithDetails,
    RouteVisualizationData,
    RouteVisualizationNode,
    TargetComparisonData,
} from '@/types'
import { getAllRouteInchiKeysSet } from '@/lib/route-visualization'
import { layoutTree } from '@/lib/route-visualization/layout'
import * as benchmarkData from '@/lib/services/data/benchmark.data'
import * as predictionData from '@/lib/services/data/prediction.data'
import * as routeData from '@/lib/services/data/route.data'
import * as stockData from '@/lib/services/data/stock.data'
import * as stockView from '@/lib/services/view/stock.view'
import { buildRouteTree } from '@/lib/tree-builder/route-tree'

// ============================================================================
// Helper Functions
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

// ============================================================================
// Acceptable Route Functions
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
 * [NEW] The "mega-dto" orchestrator for the target comparison page.
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
    viewModeProp?: string,
    acceptableIndexProp: number = 0
): Promise<TargetComparisonData> {
    // --- Wave 1: Fetch base contextual data in parallel ---
    const [benchmark, availableRunsResult, acceptableRoutes] = await Promise.all([
        benchmarkData.findBenchmarkListItemById(benchmarkId),
        predictionData.findPredictionRunsForTarget(targetId), // New function, see below
        routeData.findAcceptableRoutesForTarget(targetId),
    ])

    // --- Process Wave 1 and Prepare for Wave 2 ---
    const totalAcceptableRoutes = acceptableRoutes.length
    const currentAcceptableIndex =
        totalAcceptableRoutes > 0 ? Math.min(Math.max(0, acceptableIndexProp), totalAcceptableRoutes - 1) : 0
    const selectedAcceptable = totalAcceptableRoutes > 0 ? acceptableRoutes[currentAcceptableIndex] : undefined

    // --- Wave 2: Fetch specific route data based on URL params ---
    const [acceptableRouteData, acceptableRouteLayout, model1Tree, model2Tree] = await Promise.all([
        selectedAcceptable ? getAcceptableRouteData(selectedAcceptable.route.id, targetId) : Promise.resolve(undefined),
        selectedAcceptable
            ? getRouteTreeWithLayout(selectedAcceptable.route.id, 'acceptable-route-')
            : Promise.resolve(undefined),
        model1Id ? predictionData.getPredictedRouteForTarget(targetId, model1Id, rank1) : Promise.resolve(undefined),
        model2Id ? predictionData.getPredictedRouteForTarget(targetId, model2Id, rank2) : Promise.resolve(undefined),
    ])

    // --- Process Wave 2 and Prepare for Wave 3 ---
    const acceptableRouteTree = acceptableRouteData ? toVisualizationNode(acceptableRouteData.rootNode) : undefined
    const model1RouteTree = model1Tree ? toVisualizationNode(model1Tree) : undefined
    const model2RouteTree = model2Tree ? toVisualizationNode(model2Tree) : undefined

    const allInchiKeys = new Set<string>()
    if (acceptableRouteTree) getAllRouteInchiKeysSet(acceptableRouteTree).forEach((key) => allInchiKeys.add(key))
    if (model1RouteTree) getAllRouteInchiKeysSet(model1RouteTree).forEach((key) => allInchiKeys.add(key))
    if (model2RouteTree) getAllRouteInchiKeysSet(model2RouteTree).forEach((key) => allInchiKeys.add(key))

    // --- Wave 3: Fetch all stock data in one shot ---
    let inStockInchiKeys = new Set<string>()
    let buyableMetadataMap = new Map<string, BuyableMetadata>()
    if (benchmark.stock && allInchiKeys.size > 0) {
        const [keysInStock, metadata] = await Promise.all([
            stockData.findStockDataForInchiKeys(Array.from(allInchiKeys), benchmark.stock.id),
        ]).then(([stockItems]) => {
            const keys = new Set<string>()
            const meta = new Map<string, BuyableMetadata>()
            for (const item of stockItems) {
                keys.add(item.molecule.inchikey)
                meta.set(item.molecule.inchikey, item)
            }
            return [keys, meta] as [Set<string>, Map<string, BuyableMetadata>]
        })
        inStockInchiKeys = keysInStock
        buyableMetadataMap = metadata
    }
    // --- Final Assembly: Business logic and DTO construction ---
    const model1Run = availableRunsResult.find((run) => run.id === model1Id)
    const model2Run = availableRunsResult.find((run) => run.id === model2Id)

    const validModes = ['gt-only', 'gt-vs-pred', 'pred-vs-pred']
    const currentMode =
        modeProp && validModes.includes(modeProp) ? (modeProp as any) : acceptableRouteTree ? 'gt-only' : 'pred-vs-pred'

    const validViewModes = ['side-by-side', 'diff-overlay']
    const viewMode = viewModeProp && validViewModes.includes(viewModeProp) ? (viewModeProp as any) : 'side-by-side'

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
                  }
                : undefined,
        totalAcceptableRoutes,
        currentAcceptableIndex,
        model1:
            model1Id && model1Run && model1RouteTree
                ? {
                      runId: model1Id,
                      rank: rank1,
                      maxRank: model1Run.maxRank,
                      name: `${model1Run.modelName} (${model1Run.algorithmName})`,
                      routeTree: model1RouteTree,
                  }
                : undefined,
        model2:
            model2Id && model2Run && model2RouteTree
                ? {
                      runId: model2Id,
                      rank: rank2,
                      maxRank: model2Run.maxRank,
                      name: `${model2Run.modelName} (${model2Run.algorithmName})`,
                      routeTree: model2RouteTree,
                  }
                : undefined,
        stockInfo: { inStockInchiKeys, buyableMetadataMap },
        currentMode,
        viewMode,
    }
}
