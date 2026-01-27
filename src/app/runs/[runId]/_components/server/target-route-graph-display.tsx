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

    const solvability = currentPrediction?.solvability

    return (
        <RouteDisplayCard
            route={currentPrediction?.route}
            predictionRoute={currentPrediction?.predictionRoute}
            visualizationNode={currentPrediction?.visualizationNode}
            acceptableRouteVisualizationNode={acceptableRoute?.visualizationNode}
            isSolvable={solvability?.isSolvable}
            matchesAcceptable={solvability?.matchesAcceptable}
            inStockInchiKeys={stockInfo.inStockInchiKeys}
            buyableMetadataMap={stockInfo.buyableMetadataMap}
            stockName={stockInfo.stockName}
            layout={layout}
            navigation={navigation}
            acceptableRouteNav={acceptableRouteNav}
        />
    )
}
