import type { TargetComparisonData } from '@/types'
import { CompactRankNavigator } from '@/components/navigation'
import { RouteGraph, RouteLegend } from '@/components/route-visualization'

import { RouteJsonViewer } from '../client/route-json-viewer'

interface AcceptableRouteViewerProps {
    data: TargetComparisonData
}

function NoAcceptableRoute() {
    return (
        <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center text-sm">
            No acceptable routes available for this target.
        </div>
    )
}

/** a dedicated view for displaying a single acceptable route with its navigation. */
export function AcceptableRouteViewer({ data }: AcceptableRouteViewerProps) {
    const { acceptableRoute, totalAcceptableRoutes, currentAcceptableIndex, stockInfo } = data
    if (!acceptableRoute) return <NoAcceptableRoute />

    const hasMultiple = totalAcceptableRoutes > 1

    return (
        <div className="space-y-4">
            {hasMultiple && (
                <div className="bg-muted/50 rounded-lg border p-4">
                    <div className="mx-auto flex max-w-md justify-center">
                        <CompactRankNavigator
                            paramName="acceptableIndex"
                            currentRank={currentAcceptableIndex}
                            rankCount={totalAcceptableRoutes}
                            availableRanks={acceptableRoute.availableRanks}
                            isZeroBased
                        />
                    </div>
                </div>
            )}
            <div className="bg-muted/50 rounded-lg border p-4">
                <div className="mb-4">
                    <h2 className="text-lg font-semibold">
                        Acceptable Route
                        {hasMultiple && ` ${currentAcceptableIndex + 1} of ${totalAcceptableRoutes}`}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {`Synthesis route with ${acceptableRoute.route.length} steps${acceptableRoute.route.isConvergent ? ' (convergent)' : ''}`}
                    </p>
                </div>
                <div className="bg-background h-[750px] w-full rounded-lg border">
                    <RouteGraph
                        route={acceptableRoute.visualizationNode}
                        inStockInchiKeys={stockInfo.inStockInchiKeys}
                        buyableMetadataMap={stockInfo.buyableMetadataMap}
                        idPrefix="acceptable-route-"
                        preCalculatedNodes={acceptableRoute.layout?.nodes}
                        preCalculatedEdges={acceptableRoute.layout?.edges}
                    />
                </div>
                <div className="mt-4 flex justify-end">
                    <RouteLegend viewMode="prediction-only" />
                </div>
                <details className="mt-4 text-sm">
                    <summary className="cursor-pointer font-medium">View JSON</summary>
                    <div className="mt-4">
                        <RouteJsonViewer routeData={acceptableRoute.data} />
                    </div>
                </details>
            </div>
        </div>
    )
}
