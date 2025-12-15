import * as fs from 'fs'
import * as zlib from 'zlib'
import { cache } from 'react'
import { Prisma } from '@prisma/client'

import type {
    LoadBenchmarkResult,
    Route,
    RouteNodeWithDetails,
    RouteVisualizationData,
    RouteVisualizationNode,
} from '@/types'
import prisma from '@/lib/db'
import { layoutTree } from '@/lib/route-visualization/layout'

import { buildRouteTree } from './route-tree-builder'

// ============================================================================
// Route Query Functions
// ============================================================================

/**
 * Retrieves a route by ID.
 *
 * @param routeId - The route ID
 * @returns Route data
 * @throws Error if route not found
 */
export async function getRouteById(routeId: string): Promise<Route> {
    const route = await prisma.route.findUnique({
        where: { id: routeId },
    })

    if (!route) {
        throw new Error('Route not found')
    }

    return {
        id: route.id,
        signature: route.signature,
        contentHash: route.contentHash,
        length: route.length,
        isConvergent: route.isConvergent,
    }
}

/**
 * Fetches acceptable route with nodes and builds hierarchical tree.
 * Used for displaying acceptable routes in comparison views.
 *
 * @param routeId - The acceptable route ID
 * @returns Hierarchical route tree, or null if not found
 */
async function _getAcceptableRouteWithNodes(routeId: string): Promise<RouteNodeWithDetails | null> {
    try {
        const route = await prisma.route.findUnique({
            where: { id: routeId },
            include: {
                nodes: {
                    include: {
                        molecule: true,
                    },
                },
            },
        })

        if (!route || route.nodes.length === 0) {
            return null
        }

        // Build hierarchical tree from flat node array using shared helper
        return buildRouteTree(route.nodes)
    } catch (error) {
        console.error('Failed to fetch acceptable route:', error)
        return null
    }
}

export const getAcceptableRouteWithNodes = cache(_getAcceptableRouteWithNodes)

/**
 * Builds route node tree in memory from a single database query.
 * Fetches all nodes for a route at once to avoid N+1 query problem.
 *
 * @param rootNodeId - Root node ID
 * @param routeId - Route ID to fetch all nodes for
 * @returns Complete route node tree
 */
async function _buildRouteNodeTree(rootNodeId: string, routeId: string): Promise<RouteNodeWithDetails> {
    // Fetch all nodes for this route in a single query
    const nodes = await prisma.routeNode.findMany({
        where: { routeId },
        include: { molecule: true },
    })

    if (nodes.length === 0) {
        throw new Error('Route has no nodes')
    }

    // Build node map with empty children arrays
    const nodeMap = new Map<string, RouteNodeWithDetails>()
    nodes.forEach((node) => {
        nodeMap.set(node.id, {
            id: node.id,
            routeId: node.routeId,
            moleculeId: node.moleculeId,
            parentId: node.parentId,
            isLeaf: node.isLeaf,
            reactionHash: node.reactionHash,
            template: node.template,
            metadata: node.metadata,
            molecule: node.molecule,
            children: [],
        })
    })

    // Build parent-child relationships
    nodes.forEach((node) => {
        if (node.parentId && nodeMap.has(node.parentId)) {
            nodeMap.get(node.parentId)!.children.push(nodeMap.get(node.id)!)
        }
    })

    const rootNode = nodeMap.get(rootNodeId)
    if (!rootNode) {
        throw new Error('Root node not found in the fetched nodes')
    }

    return rootNode
}

/**
 * Shared cached route node tree builder.
 * OPTIMIZATION: React.cache ensures this function is only called once per request
 * for the same arguments, even when used by multiple service functions.
 * This prevents duplicate DB queries when getAcceptableRouteData,
 * getRouteTreeForVisualization, and getRouteTreeWithLayout are called together.
 */
const buildRouteNodeTree = cache(_buildRouteNodeTree)

/**
 * Retrieves complete acceptable route tree for visualization.
 * Used for benchmark acceptable routes that are linked to targets via AcceptableRoute junction table.
 *
 * @param routeId - The route ID
 * @param targetId - The target ID to link the route to
 * @returns Route with full node tree and target
 * @throws Error if route or target not found
 */
async function _getAcceptableRouteData(routeId: string, targetId: string): Promise<RouteVisualizationData> {
    // Batch independent queries
    const [route, target, rootNode, acceptableRoutesCount] = await Promise.all([
        prisma.route.findUnique({
            where: { id: routeId },
        }),
        prisma.benchmarkTarget.findUnique({
            where: { id: targetId },
            include: {
                molecule: true,
            },
        }),
        prisma.routeNode.findFirst({
            where: {
                routeId,
                parentId: null,
            },
        }),
        prisma.acceptableRoute.count({
            where: { benchmarkTargetId: targetId },
        }),
    ])

    if (!route) {
        throw new Error('Route not found')
    }

    if (!target) {
        throw new Error('Target not found')
    }

    if (!rootNode) {
        throw new Error('Route has no root node')
    }

    // Build tree using shared function
    const tree = await buildRouteNodeTree(rootNode.id, routeId)

    return {
        route: {
            id: route.id,
            signature: route.signature,
            contentHash: route.contentHash,
            length: route.length,
            isConvergent: route.isConvergent,
        },
        target: {
            id: target.id,
            benchmarkSetId: target.benchmarkSetId,
            targetId: target.targetId,
            moleculeId: target.moleculeId,
            routeLength: target.routeLength,
            isConvergent: target.isConvergent,
            metadata: target.metadata,
            molecule: target.molecule,
            hasAcceptableRoutes: acceptableRoutesCount > 0,
            acceptableRoutesCount,
        },
        rootNode: tree,
    }
}

// Per-request cache wrapper
export const getAcceptableRouteData = cache(_getAcceptableRouteData)

/**
 * Retrieves all acceptable routes for a target with route metadata.
 * Returns routes ordered by routeIndex (0 = primary acceptable route).
 *
 * @param targetId - The benchmark target ID
 * @returns Array of acceptable routes with route metadata, ordered by routeIndex
 */
async function _getAcceptableRoutesForTarget(
    targetId: string
): Promise<Array<{ routeIndex: number; route: { id: string; contentHash: string | null; signature: string | null } }>> {
    const acceptableRoutes = await prisma.acceptableRoute.findMany({
        where: { benchmarkTargetId: targetId },
        include: {
            route: {
                select: {
                    id: true,
                    contentHash: true,
                    signature: true,
                },
            },
        },
        orderBy: { routeIndex: 'asc' },
    })

    return acceptableRoutes.map((ar) => ({
        routeIndex: ar.routeIndex,
        route: {
            id: ar.route.id,
            contentHash: ar.route.contentHash,
            signature: ar.route.signature,
        },
    }))
}

// Per-request cache wrapper
export const getAcceptableRoutesForTarget = cache(_getAcceptableRoutesForTarget)

/**
 * Retrieves complete predicted route tree for visualization.
 * Used for model predictions which are linked via PredictionRoute junction table.
 *
 * @param predictionRouteId - The prediction route ID (junction table)
 * @returns Route with full node tree, target, and prediction metadata
 * @throws Error if prediction route not found
 */
async function _getPredictedRouteData(predictionRouteId: string): Promise<RouteVisualizationData> {
    const predictionRoute = await prisma.predictionRoute.findUnique({
        where: { id: predictionRouteId },
        include: {
            route: true,
            target: {
                include: {
                    molecule: true,
                },
            },
        },
    })

    if (!predictionRoute) {
        throw new Error('Prediction route not found')
    }

    // Find root node
    const rootNode = await prisma.routeNode.findFirst({
        where: {
            routeId: predictionRoute.routeId,
            parentId: null,
        },
    })

    if (!rootNode) {
        throw new Error('Route has no root node')
    }

    // Build tree
    const tree = await buildRouteNodeTree(rootNode.id, predictionRoute.routeId)

    // Count acceptable routes for this target
    const acceptableRoutesCount = await prisma.acceptableRoute.count({
        where: { benchmarkTargetId: predictionRoute.target.id },
    })

    return {
        route: {
            id: predictionRoute.route.id,
            signature: predictionRoute.route.signature,
            contentHash: predictionRoute.route.contentHash,
            length: predictionRoute.route.length,
            isConvergent: predictionRoute.route.isConvergent,
        },
        predictionRoute: {
            id: predictionRoute.id,
            routeId: predictionRoute.routeId,
            predictionRunId: predictionRoute.predictionRunId,
            targetId: predictionRoute.targetId,
            rank: predictionRoute.rank,
            metadata: predictionRoute.metadata,
        },
        target: {
            id: predictionRoute.target.id,
            benchmarkSetId: predictionRoute.target.benchmarkSetId,
            targetId: predictionRoute.target.targetId,
            moleculeId: predictionRoute.target.moleculeId,
            routeLength: predictionRoute.target.routeLength,
            isConvergent: predictionRoute.target.isConvergent,
            metadata: predictionRoute.target.metadata,
            molecule: predictionRoute.target.molecule,
            hasAcceptableRoutes: acceptableRoutesCount > 0,
            acceptableRoutesCount,
        },
        rootNode: tree,
    }
}

export const getPredictedRouteData = cache(_getPredictedRouteData)

/**
 * Retrieves all predicted routes for a target.
 * Note: This does NOT include acceptable routes (those don't have PredictionRoute records).
 * Acceptable routes are linked via AcceptableRoute junction table.
 *
 * @param targetId - The benchmark target ID
 * @param predictionRunId - Optional: Filter by specific prediction run
 * @returns Array of prediction routes with route data, ordered by rank
 */
export async function getRoutesByTarget(targetId: string, predictionRunId?: string) {
    const predictionRoutes = await prisma.predictionRoute.findMany({
        where: {
            targetId,
            ...(predictionRunId && { predictionRunId }),
        },
        include: {
            route: true,
        },
        orderBy: { rank: 'asc' },
    })

    return predictionRoutes.map((pr) => ({
        predictionRoute: {
            id: pr.id,
            routeId: pr.routeId,
            predictionRunId: pr.predictionRunId,
            targetId: pr.targetId,
            rank: pr.rank,
            metadata: pr.metadata,
        },
        route: {
            id: pr.route.id,
            signature: pr.route.signature,
            contentHash: pr.route.contentHash,
            length: pr.route.length,
            isConvergent: pr.route.isConvergent,
        },
    }))
}

/**
 * Transforms a RouteNodeWithDetails tree into a visualization tree.
 * Extracts SMILES and InChiKey from molecules and flattens the structure.
 *
 * @param node - The route node tree with molecule details
 * @returns Simplified tree structure with SMILES, InChiKey, and children
 */
function transformToVisualizationTree(node: RouteNodeWithDetails): RouteVisualizationNode {
    return {
        smiles: node.molecule.smiles,
        inchikey: node.molecule.inchikey,
        children:
            node.children.length > 0 ? node.children.map((child) => transformToVisualizationTree(child)) : undefined,
    }
}

/**
 * Retrieves a route tree optimized for visualization.
 * Returns simplified tree structure with SMILES and InChiKey for each node.
 *
 * @param routeId - The route ID
 * @returns Route tree with SMILES and InChiKey hierarchy
 * @throws Error if route not found
 */
async function _getRouteTreeForVisualization(routeId: string): Promise<RouteVisualizationNode> {
    // Batch independent queries
    const [route, rootNode] = await Promise.all([
        prisma.route.findUnique({
            where: { id: routeId },
        }),
        prisma.routeNode.findFirst({
            where: {
                routeId,
                parentId: null,
            },
        }),
    ])

    if (!route) {
        throw new Error('Route not found')
    }

    if (!rootNode) {
        throw new Error('Route has no root node')
    }

    // Build tree using shared function
    const tree = await buildRouteNodeTree(rootNode.id, routeId)

    // Transform to visualization format
    return transformToVisualizationTree(tree)
}

// Per-request cache wrapper
export const getRouteTreeForVisualization = cache(_getRouteTreeForVisualization)

/**
 * Retrieves a route tree with pre-calculated layout positions.
 * Performs all layout calculations server-side to minimize client-side work.
 * Returns positioned nodes and edges ready for React Flow rendering.
 *
 * @param routeId - The route ID
 * @param idPrefix - Prefix for node IDs (e.g., "gt-route-", "pred1-")
 * @returns Object with positioned nodes array and edges array
 * @throws Error if route not found
 */
async function _getRouteTreeWithLayout(
    routeId: string,
    idPrefix: string
): Promise<{
    nodes: Array<{ id: string; smiles: string; inchikey: string; x: number; y: number }>
    edges: Array<{ source: string; target: string }>
}> {
    // Get the visualization tree (internally uses shared buildRouteNodeTree via cache)
    const tree = await getRouteTreeForVisualization(routeId)

    // Calculate layout server-side
    const layout = layoutTree(tree, idPrefix)

    return layout
}

// Per-request cache wrapper
export const getRouteTreeWithLayout = cache(_getRouteTreeWithLayout)
