import { Star } from 'lucide-react'

import type {
    BuyableMetadata,
    EvaluationStatus,
    PredictionCandidate,
    Route,
    RouteLayoutMode,
    RouteVisualizationNode,
} from '@/types'
import { CompactRankNavigator, ControlGrid, ControlGridSlot } from '@/components/navigation'
import { RouteComparison, RouteGraph, RouteLegend } from '@/components/route-visualization'
import { displaySolvStatus } from '@/lib/retrocast-metrics'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

import { RouteViewToggle } from './route-view-toggle'

type RouteDisplayCardProps = {
    route?: Route
    predictionCandidate?: PredictionCandidate
    visualizationNode?: RouteVisualizationNode
    acceptableRouteVisualizationNode?: RouteVisualizationNode
    tier0Status?: EvaluationStatus | null
    constraintStatus?: EvaluationStatus
    metricLabel?: string
    matchesAcceptable?: boolean
    inStockInchiKeys?: Set<string>
    buyableMetadataMap?: Map<string, BuyableMetadata>
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
    predictionCandidate,
    visualizationNode,
    acceptableRouteVisualizationNode,
    tier0Status,
    constraintStatus,
    metricLabel,
    matchesAcceptable,
    inStockInchiKeys,
    buyableMetadataMap,
    layout: layoutProp,
    navigation,
    acceptableRouteNav,
}: RouteDisplayCardProps) {
    const hasRoute = !!route && !!predictionCandidate && !!visualizationNode
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
                        ) : predictionCandidate?.failureCode ? (
                            `Rank ${navigation.currentRank} failed: ${predictionCandidate.failureCode}${predictionCandidate.failureMessage ? ` — ${predictionCandidate.failureMessage}` : ''}`
                        ) : (
                            `Rank ${navigation.currentRank} not found in this prediction set.`
                        )}
                    </CardDescription>
                </div>

                {predictionCandidate && (
                    <div className="flex w-full items-center justify-between">
                        {hasRoute ? (
                            <RouteViewToggle layout={layout} hasAcceptableRoute={hasAcceptableRoute} />
                        ) : (
                            <div />
                        )}
                        <div className="flex items-center gap-2">
                            {matchesAcceptable && (
                                <Badge variant="secondary" className="gap-1 px-2 py-1">
                                    <Star className="h-3 w-3" />
                                    Acceptable Match
                                </Badge>
                            )}
                            {tier0Status && tier0Status !== 'NOT_EVALUATED' && (
                                <Badge variant={tier0Status === 'PASS' ? 'secondary' : 'destructive'}>
                                    Tier-0 {tier0Status === 'PASS' ? 'valid' : 'invalid'}
                                </Badge>
                            )}
                            {constraintStatus && constraintStatus !== 'NOT_EVALUATED' && (
                                <Badge variant={constraintStatus === 'PASS' ? 'secondary' : 'destructive'}>
                                    {displaySolvStatus(0, metricLabel ?? 'unknown', constraintStatus === 'PASS')}
                                </Badge>
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
                                {predictionCandidate?.failureCode
                                    ? `RetroCast preserved this ranked planner output as ${predictionCandidate.failureCode}.`
                                    : `No prediction candidate exists at rank ${navigation.currentRank}.`}
                                <br />
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
