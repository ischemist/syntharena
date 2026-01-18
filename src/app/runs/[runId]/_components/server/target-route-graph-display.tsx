import { AlertCircle } from 'lucide-react'

import type { TargetDisplayData } from '@/types'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { RouteDisplayCard } from '../client/route-display-card'

type TargetRouteGraphDisplayProps = {
    data: TargetDisplayData
}

/**
 * Dumb component: Passes pre-fetched, pre-computed data to the client component.
 * This component is now synchronous and has no data-fetching logic.
 */
export function TargetRouteGraphDisplay({ data }: TargetRouteGraphDisplayProps) {
    const {
        currentPrediction,
        acceptableRoute,
        stockInfo,
        currentRank,
        totalPredictions,
        currentAcceptableIndex,
        totalAcceptableRoutes,
        targetInfo,
        viewMode,
    } = data

    if (!currentPrediction) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Prediction rank {currentRank} not found.</AlertDescription>
            </Alert>
        )
    }

    const solvability = currentPrediction.solvability

    return (
        <RouteDisplayCard
            route={currentPrediction.route}
            predictionRoute={currentPrediction.predictionRoute}
            visualizationNode={currentPrediction.visualizationNode}
            acceptableRouteVisualizationNode={acceptableRoute?.visualizationNode}
            isSolvable={solvability?.isSolvable}
            matchesAcceptable={solvability?.matchesAcceptable}
            inStockInchiKeys={stockInfo.inStockInchiKeys}
            buyableMetadataMap={stockInfo.buyableMetadataMap}
            stockName={stockInfo.stockName}
            viewMode={viewMode}
            currentRank={currentRank}
            totalPredictions={totalPredictions}
            targetId={targetInfo.targetId}
            acceptableIndex={currentAcceptableIndex}
            totalAcceptableRoutes={totalAcceptableRoutes}
        />
    )
}
