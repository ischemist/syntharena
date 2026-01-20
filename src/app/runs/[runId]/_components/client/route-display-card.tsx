'use client'

import { Star } from 'lucide-react'

import type { BuyableMetadata, PredictionRoute, Route, RouteViewMode, RouteVisualizationNode } from '@/types'
import { StockTerminationBadge } from '@/components/badges/stock-termination'
import { RankSelector, StepButton } from '@/components/navigation'
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
    viewMode?: string
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

/**
 * [REFACTORED] client component for displaying a prediction route on the run detail page.
 * now uses the new data-driven navigation primitives (`StepButton`, `RankSelector`)
 * and has a cleaner, more logical layout for its controls.
 */
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
    viewMode: viewModeProp,
    navigation,
    acceptableRouteNav,
}: RouteDisplayCardProps) {
    const hasRoute = !!route && !!predictionRoute && !!visualizationNode
    const hasAcceptableRoute = !!acceptableRouteVisualizationNode

    const validViewModes: RouteViewMode[] = ['prediction-only', 'side-by-side', 'diff-overlay']
    const viewMode: RouteViewMode =
        viewModeProp && validViewModes.includes(viewModeProp as RouteViewMode)
            ? (viewModeProp as RouteViewMode)
            : 'prediction-only'

    const showAcceptableNav = acceptableRouteNav && (viewMode === 'side-by-side' || viewMode === 'diff-overlay')

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
                        <RouteViewToggle viewMode={viewMode} hasAcceptableRoute={hasAcceptableRoute} />
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
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 pt-2 sm:grid-cols-2">
                    {showAcceptableNav ? (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Acceptable Route</label>
                            <div className="flex items-center gap-2">
                                <StepButton href={acceptableRouteNav.previousRankHref} direction="prev">
                                    Prev
                                </StepButton>
                                <div className="text-muted-foreground flex-1 text-center text-sm">
                                    {acceptableRouteNav.currentAcceptableIndex + 1} of{' '}
                                    {acceptableRouteNav.availableRanks.length}
                                </div>
                                <StepButton href={acceptableRouteNav.nextRankHref} direction="next">
                                    Next
                                </StepButton>
                            </div>
                        </div>
                    ) : (
                        <div />
                    )}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Prediction Rank</label>
                        <div className="flex items-center gap-2">
                            <StepButton href={navigation.previousRankHref} direction="prev">
                                Prev
                            </StepButton>
                            <div className="text-muted-foreground flex-1 text-center text-sm">
                                {navigation.currentRank} of {navigation.availableRanks.length}
                            </div>
                            <StepButton href={navigation.nextRankHref} direction="next">
                                Next
                            </StepButton>
                            <RankSelector
                                availableRanks={navigation.availableRanks}
                                currentRank={navigation.currentRank}
                                paramName="rank"
                            />
                        </div>
                    </div>
                </div>

                <Separator />

                <div className="bg-background h-[750px] w-full rounded-lg border">
                    {!hasRoute ? (
                        <div className="flex h-full items-center justify-center">
                            <p className="text-muted-foreground text-center text-sm">
                                No prediction route exists at rank {navigation.currentRank}.<br />
                                Use the navigation above to browse other ranks.
                            </p>
                        </div>
                    ) : viewMode === 'prediction-only' ? (
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
                            mode={viewMode}
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

                {hasRoute && <RouteLegend viewMode={viewMode} />}
            </CardContent>
        </Card>
    )
}
