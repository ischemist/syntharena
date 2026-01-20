'use client'

import { Star } from 'lucide-react'

import type { BuyableMetadata, PredictionRoute, Route, RouteViewMode, RouteVisualizationNode } from '@/types'
import { StockTerminationBadge } from '@/components/badges/stock-termination'
import { RoutePagination } from '@/components/route-pagination'
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
    currentRank?: number
    totalPredictions?: number
    targetId?: string
    acceptableIndex?: number
    totalAcceptableRoutes?: number
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
    viewMode: viewModeProp,
    currentRank,
    totalPredictions,
    targetId,
    acceptableIndex = 0,
    totalAcceptableRoutes = 0,
}: RouteDisplayCardProps) {
    const hasRoute = !!route && !!predictionRoute && !!visualizationNode
    const hasAcceptableRoute = !!acceptableRouteVisualizationNode
    const hasNavigation = currentRank !== undefined && totalPredictions !== undefined && targetId !== undefined
    const hasMultipleAcceptableRoutes = totalAcceptableRoutes > 1

    const validViewModes: RouteViewMode[] = ['prediction-only', 'side-by-side', 'diff-overlay']
    const viewMode: RouteViewMode =
        viewModeProp && validViewModes.includes(viewModeProp as RouteViewMode)
            ? (viewModeProp as RouteViewMode)
            : 'prediction-only'

    const showAcceptableNav =
        hasMultipleAcceptableRoutes && (viewMode === 'side-by-side' || viewMode === 'diff-overlay')

    return (
        <Card variant="bordered">
            {/* --- NEW: Two-row header for clean separation --- */}
            <CardHeader className="space-y-4">
                {/* Row 1: Title and Description */}
                <div className="grid gap-1">
                    <CardTitle className="text-xl font-semibold">Prediction Route</CardTitle>
                    <CardDescription>
                        {hasRoute ? (
                            <>
                                Rank {predictionRoute.rank} • Length: {route.length} steps •{' '}
                                {route.isConvergent ? 'Convergent' : 'Linear'}
                            </>
                        ) : (
                            `Rank ${currentRank} not found`
                        )}
                    </CardDescription>
                </div>

                {/* Row 2: Actions and Status Badges */}
                {hasRoute && (
                    <div className="flex w-full items-center justify-between">
                        {/* Left-aligned controls */}
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-sm">View:</span>
                            <RouteViewToggle viewMode={viewMode} hasAcceptableRoute={hasAcceptableRoute} />
                        </div>
                        {/* Right-aligned status badges */}
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
                {(hasNavigation || showAcceptableNav) && (
                    <>
                        <Separator />
                        <div className="grid grid-cols-1 gap-x-6 gap-y-4 pt-2 sm:grid-cols-2">
                            {showAcceptableNav ? (
                                <div>
                                    <label className="text-sm font-medium">Acceptable Route</label>
                                    <RoutePagination
                                        paramName="acceptableIndex"
                                        currentValue={acceptableIndex}
                                        maxValue={totalAcceptableRoutes}
                                        label="Route"
                                        zeroBasedIndex={true}
                                    />
                                </div>
                            ) : (
                                <div />
                            )}
                            {hasNavigation && (
                                <div>
                                    <label className="text-sm font-medium">Prediction Rank</label>
                                    <RoutePagination
                                        paramName="rank"
                                        currentValue={currentRank!}
                                        maxValue={totalPredictions!}
                                        label="Rank"
                                    />
                                </div>
                            )}
                        </div>
                    </>
                )}

                <Separator />

                {/* Route visualization */}
                <div className="h-[750px] w-full rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                    {!hasRoute && (
                        <div className="flex h-full items-center justify-center">
                            <p className="text-muted-foreground text-sm">
                                No prediction route exists at rank {currentRank}. Use the navigation above to browse
                                other ranks.
                            </p>
                        </div>
                    )}
                    {hasRoute && viewMode === 'prediction-only' && (
                        <RouteGraph
                            route={visualizationNode}
                            inStockInchiKeys={inStockInchiKeys ?? new Set()}
                            buyableMetadataMap={buyableMetadataMap}
                            idPrefix="run-route-"
                        />
                    )}
                    {hasRoute &&
                        (viewMode === 'side-by-side' || viewMode === 'diff-overlay') &&
                        acceptableRouteVisualizationNode && (
                            <RouteComparison
                                acceptableRoute={acceptableRouteVisualizationNode}
                                predictionRoute={visualizationNode}
                                mode={viewMode}
                                inStockInchiKeys={inStockInchiKeys ?? new Set()}
                                buyableMetadataMap={buyableMetadataMap}
                                acceptableRouteLabel={
                                    hasMultipleAcceptableRoutes
                                        ? `Acceptable Route ${acceptableIndex + 1}`
                                        : 'Acceptable Route'
                                }
                            />
                        )}
                </div>

                {/* Legend - only show when route exists */}
                {hasRoute && <RouteLegend viewMode={viewMode} />}

                {/* Info - only show when route exists */}
                {hasRoute && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {viewMode === 'prediction-only'
                            ? 'Scroll to zoom. Drag to pan. Nodes marked in green are in stock.'
                            : viewMode === 'side-by-side'
                              ? 'Scroll to zoom. Drag to pan. Green = matches acceptable route, amber = extension (not in acceptable route).'
                              : 'Scroll to zoom. Drag to pan. Green = matches acceptable route, amber = extension, dashed gray = missing from prediction.'}
                    </p>
                )}

                {/* Route metadata - only show when route exists */}
                {hasRoute && route.contentHash && (
                    <div className="text-muted-foreground truncate border-t pt-4 font-mono text-xs">
                        Hash: {route.contentHash}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
