import type { TargetDisplayData } from '@/types'

import { RouteDisplayCard } from '../client/route-display-card'

type TargetRouteGraphDisplayProps = {
    data: TargetDisplayData
}

/**
 * Dumb component: Passes pre-fetched, pre-computed data to the client component.
 * This component is now synchronous and has no data-fetching logic.
 * Renders RouteDisplayCard regardless of whether currentPrediction exists -
 * the card handles the empty state internally to maintain consistent layout.
 */
export function TargetRouteGraphDisplay({ data }: TargetRouteGraphDisplayProps) {
    const { currentPrediction, acceptableRoute, stockInfo, layout, navigation, acceptableRouteNav } = data

    const evaluation = currentPrediction?.evaluation

    return (
        <RouteDisplayCard
            route={currentPrediction?.route ?? undefined}
            predictionCandidate={currentPrediction?.predictionCandidate}
            visualizationNode={currentPrediction?.visualizationNode ?? undefined}
            acceptableRouteVisualizationNode={acceptableRoute?.visualizationNode}
            tier0Status={evaluation?.tier0Status}
            constraintStatus={evaluation?.constraintStatus}
            metricLabel={evaluation?.metricLabel}
            matchesAcceptable={evaluation?.matchesAcceptable ?? undefined}
            inStockInchiKeys={stockInfo.inStockInchiKeys}
            buyableMetadataMap={stockInfo.buyableMetadataMap}
            layout={layout}
            navigation={navigation}
            acceptableRouteNav={acceptableRouteNav}
        />
    )
}
