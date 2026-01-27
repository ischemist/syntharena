import { Star } from 'lucide-react'

import type { BuyableMetadata, PredictionRoute, Route, RouteLayoutMode, RouteVisualizationNode } from '@/types'
import { StockTerminationBadge } from '@/components/badges/stock-termination'
import { CompactRankNavigator, ControlGrid, ControlGridSlot } from '@/components/navigation'
import { RouteComparison, RouteGraph, RouteLegend } from '@/components/route-visualization'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

import { RouteViewToggle } from './route-view-toggle'

type RouteDisplayCardProps = {
    route?: Route
    predictionRoute?: PredictionRoute
    visualizationNode?: RouteVisualizationNode
    acceptableRouteVisualizationNode?: RouteVisualizationNode
    isSolvable?: boolean
    matchesAcceptable?: boolean
    inStockInchiKeys?: Set<string>
    buyableMetadataMap?: Map<string, BuyableMetadata>
    stockName?: string
    layout?: RouteLayoutMode
    navigation: {
        currentRank: number
        availableRanks: number[]
        previousRankHref: string | null
        nextRankHref: string | null
    }
    acceptableRouteNav?: {
        currentAcceptableIndex: number
        availableRanks: number[]
        previousRankHref: string | null
        nextRankHref: string | null
    }
}

export function RouteDisplayCard({
    route,
    predictionRoute,
    visualizationNode,
    acceptableRouteVisualizationNode,
    isSolvable,
    matchesAcceptable,
    inStockInchiKeys,
    buyableMetadataMap,
    stockName,
    layout: layoutProp,
    navigation,
    acceptableRouteNav,
}: RouteDisplayCardProps) {
    const hasRoute = !!route && !!predictionRoute && !!visualizationNode
    const hasAcceptableRoute = !!acceptableRouteVisualizationNode

    const layout: RouteLayoutMode = layoutProp || 'prediction-only' // [RENAMED]
    const showAcceptableNav = acceptableRouteNav && (layout === 'side-by-side' || layout === 'diff-overlay')

    return (
        <Card variant="bordered">
            <CardHeader className="space-y-4">
                <div className="grid gap-1">
                    <CardTitle className="text-xl font-semibold">Prediction Route</CardTitle>
                    <CardDescription>
                        {hasRoute ? (
                            <>
                                Rank {navigation.currentRank} • Length: {route.length} steps •{' '}
                                {route.isConvergent ? 'Convergent' : 'Linear'}
                            </>
                        ) : (
                            `Rank ${navigation.currentRank} not found in this prediction set.`
                        )}
                    </CardDescription>
                </div>

                {hasRoute && (
                    <div className="flex w-full items-center justify-between">
                        <RouteViewToggle layout={layout} hasAcceptableRoute={hasAcceptableRoute} />
                        <div className="flex items-center gap-2">
                            {matchesAcceptable && (
                                <Badge variant="secondary" className="gap-1 px-2 py-1">
                                    <Star className="h-3 w-3" />
                                    Acceptable Match
                                </Badge>
                            )}
                            {isSolvable !== undefined && (
                                <StockTerminationBadge
                                    isTerminated={isSolvable}
                                    stockName={stockName}
                                    badgeStyle="soft"
                                />
                            )}
                        </div>
                    </div>
                )}
            </CardHeader>

            <CardContent className="space-y-4">
                <Separator />
                <ControlGrid className="pt-2">
                    {showAcceptableNav && acceptableRouteNav ? (
                        <ControlGridSlot label="Acceptable Route:">
                            <CompactRankNavigator
                                paramName="acceptableIndex"
                                currentRank={acceptableRouteNav.currentAcceptableIndex}
                                rankCount={acceptableRouteNav.availableRanks.length}
                                availableRanks={acceptableRouteNav.availableRanks}
                                isZeroBased
                            />
                        </ControlGridSlot>
                    ) : (
                        <div /> // Empty div to maintain grid structure
                    )}
                    <ControlGridSlot label="Prediction:">
                        <CompactRankNavigator
                            paramName="rank"
                            currentRank={navigation.currentRank}
                            rankCount={navigation.availableRanks.length}
                            availableRanks={navigation.availableRanks}
                        />
                    </ControlGridSlot>
                </ControlGrid>

                <Separator />

                <div className="bg-background h-[750px] w-full rounded-lg border">
                    {!hasRoute ? (
                        <div className="flex h-full items-center justify-center">
                            <p className="text-muted-foreground text-center text-sm">
                                No prediction route exists at rank {navigation.currentRank}.<br />
                                Use the navigation above to browse other ranks.
                            </p>
                        </div>
                    ) : layout === 'prediction-only' ? (
                        <RouteGraph
                            route={visualizationNode}
                            inStockInchiKeys={inStockInchiKeys ?? new Set()}
                            buyableMetadataMap={buyableMetadataMap}
                            idPrefix="run-route-"
                        />
                    ) : acceptableRouteVisualizationNode ? (
                        <RouteComparison
                            acceptableRoute={acceptableRouteVisualizationNode}
                            predictionRoute={visualizationNode}
                            mode={layout}
                            inStockInchiKeys={inStockInchiKeys ?? new Set()}
                            buyableMetadataMap={buyableMetadataMap}
                            acceptableRouteLabel={`Acceptable Route ${acceptableRouteNav ? acceptableRouteNav.currentAcceptableIndex + 1 : 1}`}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <p className="text-muted-foreground text-sm">Acceptable route data not available.</p>
                        </div>
                    )}
                </div>

                {hasRoute && <RouteLegend viewMode={layout} />}
            </CardContent>
        </Card>
    )
}
