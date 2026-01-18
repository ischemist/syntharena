import { AlertCircle } from 'lucide-react'

import type { BuyableMetadata, RouteNodeWithDetails, RouteVisualizationNode, TargetPredictionDetail } from '@/types'
import * as stockData from '@/lib/services/data/stock.data'
import * as predictionView from '@/lib/services/view/prediction.view'
import * as stockView from '@/lib/services/view/stock.view'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { RouteDisplayCard } from '../client/route-display-card'

function toVisualizationNode(node: RouteNodeWithDetails): RouteVisualizationNode {
    return {
        smiles: node.molecule.smiles,
        inchikey: node.molecule.inchikey,
        children: node.children.length > 0 ? node.children.map(toVisualizationNode) : undefined,
    }
}

function collectInchiKeysFromRouteNode(node: RouteNodeWithDetails, set: Set<string>): void {
    set.add(node.molecule.inchikey)
    node.children.forEach((child) => collectInchiKeysFromRouteNode(child, set))
}

type TargetRouteGraphDisplayProps = {
    targetDetail: TargetPredictionDetail
    runId: string
    rank: number
    stockId?: string
    viewMode?: string
    acceptableIndex?: number
}

export async function TargetRouteGraphDisplay({
    targetDetail,
    rank,
    stockId,
    viewMode,
    acceptableIndex: acceptableIndexProp,
}: TargetRouteGraphDisplayProps) {
    const hasRoutes = targetDetail.routes.length > 0
    if (!hasRoutes) return null // No routes to display

    // --- Additional data fetching specific to this component ---
    let acceptableRouteNode: RouteNodeWithDetails | undefined
    let acceptableIndex = 0
    let totalAcceptableRoutes = 0
    if (targetDetail.acceptableRoutes && targetDetail.acceptableRoutes.length > 0) {
        totalAcceptableRoutes = targetDetail.acceptableRoutes.length
        acceptableIndex = Math.min(Math.max(0, acceptableIndexProp ?? 0), totalAcceptableRoutes - 1)
        const selectedRoute = targetDetail.acceptableRoutes[acceptableIndex]
        acceptableRouteNode = (await predictionView.getAcceptableRouteWithNodes(selectedRoute.id)) ?? undefined
    }

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

    let inStockInchiKeys = new Set<string>()
    let buyableMetadataMap = new Map<string, BuyableMetadata>()
    let stockName: string | undefined

    if (stockId) {
        const allInchiKeys = new Set<string>()
        collectInchiKeysFromRouteNode(routeDetail.routeNode, allInchiKeys)
        if (acceptableRouteNode) {
            collectInchiKeysFromRouteNode(acceptableRouteNode, allInchiKeys)
        }

        const [keysInStock, metadata] = await Promise.all([
            stockData.findInchiKeysInStock(Array.from(allInchiKeys), stockId),
            stockView.getBuyableMetadataMap(Array.from(allInchiKeys), stockId),
        ])
        inStockInchiKeys = keysInStock
        buyableMetadataMap = metadata
    }
    // --- End additional fetching ---

    const solvability = stockId ? routeDetail.solvability.find((s) => s.stockId === stockId) : undefined
    stockName = solvability?.stockName

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
            targetId={targetDetail.targetId}
            acceptableIndex={acceptableIndex}
            totalAcceptableRoutes={totalAcceptableRoutes}
        />
    )
}
