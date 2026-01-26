import Link from 'next/link'

import type { TargetComparisonData } from '@/types'
import { ControlGrid, ControlGridSlot, ModelSelector, RankNavigator } from '@/components/navigation'
import { RouteComparison, RouteLegend } from '@/components/route-visualization'
import { Button } from '@/components/ui/button'

interface GroundTruthComparisonViewProps {
    data: TargetComparisonData
}

/** a dedicated view for comparing an acceptable route vs. a model prediction. */
export function GroundTruthComparisonView({ data }: GroundTruthComparisonViewProps) {
    const { acceptableRoute, model1, availableRuns, displayMode, stockInfo } = data

    return (
        <div className="space-y-4">
            <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
                <ControlGrid>
                    <ControlGridSlot label="Acceptable Route:">
                        <RankNavigator
                            paramName="acceptableIndex"
                            prevHref={acceptableRoute?.previousRankHref ?? null}
                            nextHref={acceptableRoute?.nextRankHref ?? null}
                            currentRank={data.currentAcceptableIndex}
                            rankCount={data.totalAcceptableRoutes}
                            availableRanks={acceptableRoute?.availableRanks ?? []}
                            label="Route"
                            isZeroBased
                        />
                    </ControlGridSlot>
                    <ControlGridSlot label="Model Prediction:">
                        <ModelSelector
                            runs={availableRuns}
                            selectedRunId={model1?.runId}
                            buildHref={(newRunId) => {
                                const params = new URLSearchParams(window.location.search)
                                const selectedRun = availableRuns.find((r) => r.id === newRunId)
                                const firstRank = selectedRun?.availableRanks[0] ?? 1
                                params.set('model1', newRunId)
                                params.set('rank1', String(firstRank))
                                return `${window.location.pathname}?${params.toString()}`
                            }}
                        />
                        {model1 && (
                            <RankNavigator
                                paramName="rank1"
                                prevHref={model1.previousRankHref}
                                nextHref={model1.nextRankHref}
                                currentRank={model1.rank}
                                rankCount={model1.availableRanks.length}
                                availableRanks={model1.availableRanks}
                                label="Rank"
                            />
                        )}
                    </ControlGridSlot>
                </ControlGrid>

                {model1 && (
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-sm font-medium">Comparison View:</span>
                        <div className="flex gap-1">
                            <Button variant={displayMode === 'side-by-side' ? 'default' : 'outline'} size="sm" asChild>
                                <Link href="?view=side-by-side" replace scroll={false}>
                                    Side-by-Side
                                </Link>
                            </Button>
                            <Button variant={displayMode === 'diff-overlay' ? 'default' : 'outline'} size="sm" asChild>
                                <Link href="?view=diff-overlay" replace scroll={false}>
                                    Diff Overlay
                                </Link>
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-muted/50 rounded-lg border p-4">
                {!model1 || !acceptableRoute ? (
                    <div className="text-muted-foreground p-12 text-center text-sm">Select a model to compare.</div>
                ) : (
                    <>
                        <div className="bg-background h-[750px] w-full rounded-lg border">
                            <RouteComparison
                                acceptableRoute={acceptableRoute.visualizationNode}
                                predictionRoute={model1.routeTree}
                                mode={displayMode}
                                inStockInchiKeys={stockInfo.inStockInchiKeys}
                                buyableMetadataMap={stockInfo.buyableMetadataMap}
                                modelName={model1.name}
                                acceptableRouteLabel={`Acceptable Route ${data.currentAcceptableIndex + 1}`}
                            />
                        </div>
                        <div className="mt-4 flex justify-end">
                            <RouteLegend viewMode={displayMode} />
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
