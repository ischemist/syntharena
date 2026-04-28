'use client'

import { RouteComparison as PackageRouteComparison } from '@ischemist/route-viewer'

import type { BuyableMetadata, RouteVisualizationNode } from '@/types'

interface RouteComparisonProps {
    acceptableRoute: RouteVisualizationNode
    predictionRoute: RouteVisualizationNode
    mode: 'side-by-side' | 'diff-overlay'
    inStockInchiKeys: Set<string>
    buyableMetadataMap?: Map<string, BuyableMetadata>
    modelName?: string
    acceptableRouteLabel?: string
}

export function RouteComparison({
    acceptableRoute,
    predictionRoute,
    mode,
    inStockInchiKeys,
    buyableMetadataMap,
    modelName,
    acceptableRouteLabel,
}: RouteComparisonProps) {
    return (
        <PackageRouteComparison
            referenceRoute={acceptableRoute}
            comparedRoute={predictionRoute}
            mode={mode}
            inStockInchiKeys={inStockInchiKeys}
            buyableMetadataMap={buyableMetadataMap}
            referenceLabel={acceptableRouteLabel ?? 'Acceptable Route'}
            comparedLabel={modelName ?? 'Prediction'}
        />
    )
}
