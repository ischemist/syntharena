import { AlertCircle } from 'lucide-react'

import type { RouteNodeWithDetails, RouteVisualizationNode } from '@/types'
import { getTargetPredictions } from '@/lib/services/prediction.service'
import * as routeService from '@/lib/services/route.service'
import { checkMoleculesInStockByInchiKey } from '@/lib/services/stock.service'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { RouteDisplayCard } from '../client/route-display-card'
import { TargetInfoCard } from '../client/target-info-card'

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

type TargetRouteDisplayProps = {
    runId: string
    targetId: string
    rank: number
    stockId?: string
    viewMode?: string
}

export async function TargetRouteDisplay({ runId, targetId, rank, stockId, viewMode }: TargetRouteDisplayProps) {
    // Fetch target predictions
    const targetDetail = await getTargetPredictions(targetId, runId, stockId)

    if (!targetDetail) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Target not found.</AlertDescription>
            </Alert>
        )
    }

    // Render target card regardless of whether routes exist
    const hasRoutes = targetDetail.routes.length > 0

    // Get stock items if stockId provided (for route visualization)
    let inStockInchiKeys = new Set<string>()
    let stockName: string | undefined

    // Build acceptable route tree if available (use primary route)
    let acceptableRouteNode: RouteNodeWithDetails | undefined
    if (targetDetail.acceptableRoutes && targetDetail.acceptableRoutes.length > 0) {
        const primaryRoute = targetDetail.acceptableRoutes[0] // Primary route is at index 0
        acceptableRouteNode = (await routeService.getAcceptableRouteWithNodes(primaryRoute.id)) ?? undefined
    }

    if (hasRoutes && stockId && stockId !== 'all') {
        try {
            // Validate rank first to get the route
            const requestedRank = Math.max(1, Math.min(rank, targetDetail.routes.length))
            const routeDetail = targetDetail.routes.find((r) => r.predictionRoute.rank === requestedRank)

            if (routeDetail) {
                // Collect all InChiKeys from the route tree
                const allInchiKeys = new Set<string>()
                collectInchiKeysFromRouteNode(routeDetail.routeNode, allInchiKeys)

                // Check which molecules from the route are in stock
                inStockInchiKeys = await checkMoleculesInStockByInchiKey(Array.from(allInchiKeys), stockId)

                // Get stock name from solvability data
                const solvabilityForStock = routeDetail.solvability.find((s) => s.stockId === stockId)
                stockName = solvabilityForStock?.stockName
            }
        } catch (error) {
            console.error('Failed to check stock availability:', error)
        }
    }

    return (
        <div className="space-y-4">
            {/* Target metadata card with 2-column layout */}
            <TargetInfoCard
                targetId={targetDetail.targetId}
                molecule={targetDetail.molecule}
                routeLength={targetDetail.routeLength}
                isConvergent={targetDetail.isConvergent}
                hasAcceptableRoutes={targetDetail.hasAcceptableRoutes}
                acceptableMatchRank={targetDetail.acceptableMatchRank}
                hasNoPredictions={!hasRoutes}
            />

            {/* Only show route if we have predictions */}
            {hasRoutes &&
                (() => {
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
                            stockName={stockName}
                            viewMode={viewMode}
                            currentRank={requestedRank}
                            totalPredictions={targetDetail.routes.length}
                            targetId={targetId}
                        />
                    )
                })()}
        </div>
    )
}
