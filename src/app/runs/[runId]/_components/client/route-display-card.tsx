'use client'

import { CheckCircle, XCircle } from 'lucide-react'

import type { BuyableMetadata, PredictionRoute, Route, RouteViewMode, RouteVisualizationNode } from '@/types'
import { RoutePagination } from '@/components/route-pagination'
import { RouteComparison, RouteGraph, RouteLegend } from '@/components/route-visualization'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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

    // Validate and default view mode
    const validViewModes: RouteViewMode[] = ['prediction-only', 'side-by-side', 'diff-overlay']
    const viewMode: RouteViewMode =
        viewModeProp && validViewModes.includes(viewModeProp as RouteViewMode)
            ? (viewModeProp as RouteViewMode)
            : 'prediction-only'

    return (
        <Card variant="bordered">
            <CardHeader>
                <div>
                    <CardTitle className="text-lg">Prediction Route</CardTitle>
                    <CardDescription>
                        {hasRoute ? (
                            <>
                                Rank {predictionRoute.rank} • Length: {route.length} steps •{' '}
                                {route.isConvergent ? 'Convergent' : 'Linear'}
                            </>
                        ) : (
                            <>Rank {currentRank} not found</>
                        )}
                    </CardDescription>
                </div>
                <CardAction>
                    {/* Badges - only show when route exists */}
                    {hasRoute && (
                        <div className="flex items-center gap-2">
                            {isSolvable !== undefined && (
                                <>
                                    {isSolvable ? (
                                        <Badge variant="default" className="gap-1">
                                            <CheckCircle className="h-3 w-3" />
                                            Solved
                                        </Badge>
                                    ) : (
                                        <Badge variant="destructive" className="gap-1">
                                            <XCircle className="h-3 w-3" />
                                            Unsolved
                                        </Badge>
                                    )}
                                </>
                            )}
                            {matchesAcceptable && (
                                <Badge variant="secondary" className="gap-1">
                                    ⭐ Acceptable Match
                                </Badge>
                            )}
                        </div>
                    )}
                </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
                {hasRoute && stockName && (
                    <div className="text-muted-foreground text-sm">
                        Solvability evaluated against: <span className="font-medium">{stockName}</span>
                    </div>
                )}

                {/* View mode toggle - only show when route exists */}
                {hasRoute && <RouteViewToggle viewMode={viewMode} hasAcceptableRoute={hasAcceptableRoute} />}

                {/* Navigation controls - two-column layout */}
                {(hasNavigation ||
                    (hasMultipleAcceptableRoutes && (viewMode === 'side-by-side' || viewMode === 'diff-overlay'))) && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                        <div className="grid gap-3 md:grid-cols-2">
                            {/* Left column: Acceptable route navigation (only in comparison mode with multiple routes) */}
                            <div className="space-y-3">
                                {hasMultipleAcceptableRoutes &&
                                (viewMode === 'side-by-side' || viewMode === 'diff-overlay') ? (
                                    <>
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Acceptable Route
                                            </label>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                                Navigate through available routes
                                            </div>
                                        </div>
                                        <RoutePagination
                                            paramName="acceptableIndex"
                                            currentValue={acceptableIndex}
                                            maxValue={totalAcceptableRoutes}
                                            label="Route"
                                            zeroBasedIndex={true}
                                        />
                                    </>
                                ) : (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Acceptable Route
                                            </label>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                                {hasAcceptableRoute ? 'Single route available' : 'No acceptable routes'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right column: Prediction rank navigation */}
                            <div className="space-y-3">
                                {hasNavigation && (
                                    <>
                                        <div>
                                            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Prediction Rank
                                            </label>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                                Navigate through predictions
                                            </div>
                                        </div>
                                        <RoutePagination
                                            paramName="rank"
                                            currentValue={currentRank!}
                                            maxValue={totalPredictions!}
                                            label="Rank"
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

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
