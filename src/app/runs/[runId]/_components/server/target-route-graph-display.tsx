import { AlertCircle } from 'lucide-react'

import type { BuyableMetadata } from '@/types'
import { getAllRouteInchiKeysSet } from '@/lib/route-visualization'
import * as stockData from '@/lib/services/data/stock.data'
import * as predictionView from '@/lib/services/view/prediction.view'
import * as routeView from '@/lib/services/view/route.view'
import * as stockView from '@/lib/services/view/stock.view'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { RouteDisplayCard } from '../client/route-display-card'

type TargetRouteGraphDisplayProps = {
    runId: string
    targetId: string
    rank: number
    totalPredictions: number
    stockId?: string
    viewMode?: string
    acceptableIndex?: number
}

export async function TargetRouteGraphDisplay({
    runId,
    targetId,
    rank,
    totalPredictions,
    stockId,
    viewMode,
    acceptableIndex: acceptableIndexProp,
}: TargetRouteGraphDisplayProps) {
    // --- Data fetching specific to this component ---
    const prediction = await predictionView.getSinglePrediction(targetId, runId, rank, stockId)

    if (!prediction) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Prediction rank {rank} not found.</AlertDescription>
            </Alert>
        )
    }

    // Fetch visualization tree for the predicted route
    const visualizationNode = await routeView.getRouteTreeForVisualization(prediction.route.id)

    // Fetch acceptable routes for comparison, if needed
    let acceptableRouteVisualizationNode
    let acceptableIndex = 0
    let totalAcceptableRoutes = 0

    const acceptableRoutes = await routeView.getAcceptableRoutesForTarget(targetId)
    totalAcceptableRoutes = acceptableRoutes.length

    if (totalAcceptableRoutes > 0) {
        acceptableIndex = Math.min(Math.max(0, acceptableIndexProp ?? 0), totalAcceptableRoutes - 1)
        const selectedAcceptable = acceptableRoutes[acceptableIndex]
        if (selectedAcceptable) {
            acceptableRouteVisualizationNode = await routeView.getRouteTreeForVisualization(selectedAcceptable.route.id)
        }
    }

    // Fetch stock availability and metadata
    let inStockInchiKeys = new Set<string>()
    let buyableMetadataMap = new Map<string, BuyableMetadata>()
    let stockName: string | undefined

    if (stockId) {
        const allInchiKeys = new Set<string>()
        getAllRouteInchiKeysSet(visualizationNode).forEach((key) => allInchiKeys.add(key))
        if (acceptableRouteVisualizationNode) {
            getAllRouteInchiKeysSet(acceptableRouteVisualizationNode).forEach((key) => allInchiKeys.add(key))
        }

        const [keysInStock, metadata] = await Promise.all([
            stockData.findInchiKeysInStock(Array.from(allInchiKeys), stockId),
            stockView.getBuyableMetadataMap(Array.from(allInchiKeys), stockId),
        ])
        inStockInchiKeys = keysInStock
        buyableMetadataMap = metadata
        stockName = prediction.solvability.find((s) => s.stockId === stockId)?.stockName
    }
    // --- End data fetching ---

    const solvability = stockId ? prediction.solvability.find((s) => s.stockId === stockId) : undefined

    return (
        <RouteDisplayCard
            route={prediction.route}
            predictionRoute={prediction.predictionRoute}
            visualizationNode={visualizationNode}
            acceptableRouteVisualizationNode={acceptableRouteVisualizationNode}
            isSolvable={solvability?.isSolvable}
            matchesAcceptable={solvability?.matchesAcceptable}
            inStockInchiKeys={inStockInchiKeys}
            buyableMetadataMap={buyableMetadataMap}
            stockName={stockName}
            viewMode={viewMode}
            currentRank={rank}
            totalPredictions={totalPredictions}
            targetId={targetId}
            acceptableIndex={acceptableIndex}
            totalAcceptableRoutes={totalAcceptableRoutes}
        />
    )
}
