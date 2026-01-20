import Link from 'next/link'

import type { TargetComparisonData } from '@/types'
import { RankSelector, StepButton } from '@/components/navigation'
import { RouteComparison, RouteLegend } from '@/components/route-visualization'
import { Button } from '@/components/ui/button'

import { ComparisonSlotControl } from '../client/comparison-slot-control'

interface GroundTruthComparisonViewProps {
    data: TargetComparisonData
}

/** a dedicated view for comparing an acceptable route vs. a model prediction. */
export function GroundTruthComparisonView({ data }: GroundTruthComparisonViewProps) {
    const { acceptableRoute, model1, availableRuns, currentMode, displayMode, stockInfo } = data

    return (
        <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg border p-4">
                <div className="space-y-4">
                    {model1 && (
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Comparison View:</span>
                            <div className="flex gap-1">
                                <Button
                                    variant={displayMode === 'side-by-side' ? 'default' : 'outline'}
                                    size="sm"
                                    asChild
                                >
                                    <Link href="?view=side-by-side" replace scroll={false}>
                                        Side-by-Side
                                    </Link>
                                </Button>
                                <Button
                                    variant={displayMode === 'diff-overlay' ? 'default' : 'outline'}
                                    size="sm"
                                    asChild
                                >
                                    <Link href="?view=diff-overlay" replace scroll={false}>
                                        Diff Overlay
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    )}
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                            <span className="text-sm font-medium">Acceptable Route:</span>
                            <div className="flex items-center gap-2">
                                <StepButton href={acceptableRoute?.previousRankHref ?? null} direction="prev">
                                    Prev
                                </StepButton>
                                <div className="text-muted-foreground flex-1 text-center text-sm">
                                    {data.currentAcceptableIndex + 1} of {data.totalAcceptableRoutes}
                                </div>
                                <StepButton href={acceptableRoute?.nextRankHref ?? null} direction="next">
                                    Next
                                </StepButton>
                                <RankSelector
                                    availableRanks={acceptableRoute?.availableRanks ?? []}
                                    currentRank={data.currentAcceptableIndex}
                                    paramName="acceptableIndex"
                                    zeroBasedIndex
                                />
                            </div>
                        </div>
                        <ComparisonSlotControl
                            runs={availableRuns}
                            selectedRunId={model1?.runId}
                            paramName="model1"
                            rankParamName="rank1"
                            label="Model Prediction"
                            navigation={model1}
                        />
                    </div>
                </div>
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
