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
    Route,
    RouteNodeWithDetails,
    RouteVisualizationData,
    RouteVisualizationNode,
} from '@/types'
import { layoutTree } from '@/lib/route-visualization/layout'
import * as benchmarkData from '@/lib/services/data/benchmark.data'
import * as routeData from '@/lib/services/data/route.data'
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
