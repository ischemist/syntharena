'use client'

import { CheckCircle, XCircle } from 'lucide-react'

import type { Route, RouteNodeWithDetails, RouteViewMode, RouteVisualizationNode } from '@/types'
import { RouteComparison, RouteGraph, RouteLegend } from '@/components/route-visualization'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { RouteViewToggle } from './route-view-toggle'

type RouteDisplayCardProps = {
    route: Route
    routeNode: RouteNodeWithDetails
    groundTruthRouteNode?: RouteNodeWithDetails
    isSolvable?: boolean
    isGtMatch?: boolean
    inStockInchiKeys: Set<string>
    stockName?: string
    viewMode?: string
}

export function RouteDisplayCard({
    route,
    routeNode,
    groundTruthRouteNode,
    isSolvable,
    isGtMatch,
    inStockInchiKeys,
    stockName,
    viewMode: viewModeProp,
}: RouteDisplayCardProps) {
    const hasGroundTruth = !!groundTruthRouteNode
    // Validate and default view mode
    const validViewModes: RouteViewMode[] = ['prediction-only', 'side-by-side', 'diff-overlay']
    const viewMode: RouteViewMode =
        viewModeProp && validViewModes.includes(viewModeProp as RouteViewMode)
            ? (viewModeProp as RouteViewMode)
            : 'prediction-only'

    // Convert RouteNodeWithDetails to RouteVisualizationNode format
    const convertToVisualizationNode = (node: RouteNodeWithDetails): RouteVisualizationNode => {
        return {
            smiles: node.molecule.smiles,
            inchikey: node.molecule.inchikey,
            children: node.children.length > 0 ? node.children.map(convertToVisualizationNode) : undefined,
        }
    }

    const visualizationRoute = convertToVisualizationNode(routeNode)
    const groundTruthVisualizationRoute = groundTruthRouteNode
        ? convertToVisualizationNode(groundTruthRouteNode)
        : undefined

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">Rank {route.rank}</CardTitle>
                        <CardDescription>
                            Length: {route.length} steps • {route.isConvergent ? 'Convergent' : 'Linear'}
                        </CardDescription>
                    </div>
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
                        {isGtMatch && (
                            <Badge variant="secondary" className="gap-1">
                                ⭐ GT Match
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {stockName && (
                    <div className="text-muted-foreground text-sm">
                        Solvability evaluated against: <span className="font-medium">{stockName}</span>
                    </div>
                )}

                {/* View mode toggle */}
                <RouteViewToggle viewMode={viewMode} hasGroundTruth={hasGroundTruth} />

                {/* Route visualization */}
                <div className="h-[750px] w-full rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                    {viewMode === 'prediction-only' && (
                        <RouteGraph
                            route={visualizationRoute}
                            inStockInchiKeys={inStockInchiKeys}
                            idPrefix="run-route-"
                        />
                    )}
                    {(viewMode === 'side-by-side' || viewMode === 'diff-overlay') && groundTruthVisualizationRoute && (
                        <RouteComparison
                            groundTruthRoute={groundTruthVisualizationRoute}
                            predictionRoute={visualizationRoute}
                            mode={viewMode}
                            inStockInchiKeys={inStockInchiKeys}
                        />
                    )}
                </div>

                {/* Legend */}
                <RouteLegend viewMode={viewMode} />

                {/* Info */}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {viewMode === 'prediction-only'
                        ? 'Scroll to zoom. Drag to pan. Nodes marked in green are in stock.'
                        : viewMode === 'side-by-side'
                          ? 'Scroll to zoom. Drag to pan. Green = match with ground truth, amber = extension (not in ground truth).'
                          : 'Scroll to zoom. Drag to pan. Green = match, amber = extension, dashed gray = missing from prediction.'}
                </p>

                {/* Route metadata */}
                {route.contentHash && (
                    <div className="text-muted-foreground truncate border-t pt-4 font-mono text-xs">
                        Hash: {route.contentHash}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
