import { CheckCircle, XCircle } from 'lucide-react'

import type { Route, RouteNodeWithDetails, RouteVisualizationNode } from '@/types'
import { RouteGraph, RouteLegend } from '@/components/route-visualization'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type RouteDisplayCardProps = {
    route: Route
    routeNode: RouteNodeWithDetails
    isSolvable?: boolean
    isGtMatch?: boolean
    inStockSmiles: Set<string>
    stockName?: string
}

export function RouteDisplayCard({
    route,
    routeNode,
    isSolvable,
    isGtMatch,
    inStockSmiles,
    stockName,
}: RouteDisplayCardProps) {
    // Convert RouteNodeWithDetails to RouteVisualizationNode format
    const convertToVisualizationNode = (node: RouteNodeWithDetails): RouteVisualizationNode => {
        return {
            smiles: node.molecule.smiles,
            children: node.children.length > 0 ? node.children.map(convertToVisualizationNode) : undefined,
        }
    }

    const visualizationRoute = convertToVisualizationNode(routeNode)

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

                {/* Route visualization */}
                <div className="min-h-[600px] rounded-md border p-4">
                    <RouteGraph route={visualizationRoute} inStockSmiles={inStockSmiles} />
                </div>

                {/* Legend */}
                <RouteLegend />

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
