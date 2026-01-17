import { AlertCircle } from 'lucide-react'

import type { BuyableMetadata, RouteNodeWithDetails, RouteVisualizationNode } from '@/types'
import * as stockData from '@/lib/services/data/stock.data'
import * as predictionView from '@/lib/services/view/prediction.view'
import * as stockView from '@/lib/services/view/stock.view'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { RouteDisplayCard } from '../client/route-display-card'

/**
 * Convert RouteNodeWithDetails to RouteVisualizationNode (client-ready format).
 */
function toVisualizationNode(node: RouteNodeWithDetails): RouteVisualizationNode {
    return {
        smiles: node.molecule.smiles,
        inchikey: node.molecule.inchikey,
        children: node.children.length > 0 ? node.children.map(toVisualizationNode) : undefined,
    }
}

/**
 * Recursively collects all InChiKeys from a route tree.
 */
function collectInchiKeysFromRouteNode(node: RouteNodeWithDetails, set: Set<string>): void {
    set.add(node.molecule.inchikey)
    if (node.children) {
        node.children.forEach((child) => collectInchiKeysFromRouteNode(child, set))
    }
}

type TargetRouteGraphDisplayProps = {
    runId: string
    targetId: string
    rank: number
    stockId?: string
    viewMode?: string
    acceptableIndex?: number
}

/**
 * Slow path: Fetch and display route graph with acceptable route comparison.
 * This component streams in after target metadata is displayed.
 */
export async function TargetRouteGraphDisplay({
    runId,
    targetId,
    rank,
    stockId,
    viewMode,
    acceptableIndex: acceptableIndexProp,
}: TargetRouteGraphDisplayProps) {
    // Fetch target predictions (cached from target-info-display)
    const targetDetail = await predictionView.getTargetPredictions(targetId, runId, stockId)

    if (!targetDetail) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Target not found.</AlertDescription>
            </Alert>
        )
    }

    const hasRoutes = targetDetail.routes.length > 0

    if (!hasRoutes) {
        return null // No routes to display
    }

    // Build acceptable route tree if available
    let acceptableRouteNode: RouteNodeWithDetails | undefined
    let acceptableIndex = 0
    let totalAcceptableRoutes = 0

    if (targetDetail.acceptableRoutes && targetDetail.acceptableRoutes.length > 0) {
        totalAcceptableRoutes = targetDetail.acceptableRoutes.length
        // Validate and clamp acceptableIndex to valid range
        acceptableIndex = Math.min(Math.max(0, acceptableIndexProp ?? 0), Math.max(0, totalAcceptableRoutes - 1))
        const selectedRoute = targetDetail.acceptableRoutes[acceptableIndex]
        acceptableRouteNode = (await predictionView.getAcceptableRouteWithNodes(selectedRoute.id)) ?? undefined
    }

    // Get stock items if stockId provided (for route visualization)
    let inStockInchiKeys = new Set<string>()
    let buyableMetadataMap = new Map<string, BuyableMetadata>()
    let stockName: string | undefined

    // Validate rank first to get the route
    const requestedRank = Math.max(1, Math.min(rank, targetDetail.routes.length))
    const routeDetail = targetDetail.routes.find((r) => r.predictionRoute.rank === requestedRank)

    if (!routeDetail) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Prediction rank {requestedRank} not found.</AlertDescription>
            </Alert>
        )
    }

    if (stockId && stockId !== 'all') {
        try {
            // Collect all InChiKeys from the route tree AND acceptable route tree
            const allInchiKeys = new Set<string>()
            collectInchiKeysFromRouteNode(routeDetail.routeNode, allInchiKeys)

            // Also collect InChiKeys from acceptable route if available
            if (acceptableRouteNode) {
                collectInchiKeysFromRouteNode(acceptableRouteNode, allInchiKeys)
            }

            // Check which molecules from the route are in stock
            inStockInchiKeys = await stockData.findInchiKeysInStock(Array.from(allInchiKeys), stockId)

            // Fetch buyable metadata for molecules in stock
            buyableMetadataMap = await stockView.getBuyableMetadataMap(Array.from(allInchiKeys), stockId)

            // Get stock name from solvability data
            const solvabilityForStock = routeDetail.solvability.find((s) => s.stockId === stockId)
            stockName = solvabilityForStock?.stockName
        } catch (error) {
            console.error('Failed to check stock availability:', error)
        }
    }

    // Get solvability status for the selected stock
    const solvability = stockId ? routeDetail.solvability.find((s) => s.stockId === stockId) : undefined

    return (
        <RouteDisplayCard
            route={routeDetail.route}
            predictionRoute={routeDetail.predictionRoute}
            visualizationNode={routeDetail.visualizationNode}
            acceptableRouteVisualizationNode={
                acceptableRouteNode ? toVisualizationNode(acceptableRouteNode) : undefined
            }
            isSolvable={solvability?.isSolvable}
            matchesAcceptable={solvability?.matchesAcceptable}
            inStockInchiKeys={inStockInchiKeys}
            buyableMetadataMap={buyableMetadataMap}
            stockName={stockName}
            viewMode={viewMode}
            currentRank={requestedRank}
            totalPredictions={targetDetail.routes.length}
            targetId={targetId}
            acceptableIndex={acceptableIndex}
            totalAcceptableRoutes={totalAcceptableRoutes}
        />
    )
}
