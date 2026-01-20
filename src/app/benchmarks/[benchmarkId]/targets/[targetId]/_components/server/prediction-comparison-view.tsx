import Link from 'next/link'

import type { TargetComparisonData } from '@/types'
import { PredictionComparison, RouteLegend } from '@/components/route-visualization'
import { Button } from '@/components/ui/button'

import { ComparisonSlotControl } from '../client/comparison-slot-control'

interface PredictionComparisonViewProps {
    data: TargetComparisonData
}

/** a dedicated view for comparing two model predictions. */
export function PredictionComparisonView({ data }: PredictionComparisonViewProps) {
    const { model1, model2, availableRuns, displayMode, stockInfo } = data

    return (
        <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg border p-4">
                <div className="space-y-4">
                    {model1 && model2 && (
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
                        <ComparisonSlotControl
                            runs={availableRuns}
                            selectedRunId={model1?.runId}
                            paramName="model1"
                            rankParamName="rank1"
                            label="Model 1"
                            navigation={model1}
                        />
                        <ComparisonSlotControl
                            runs={availableRuns}
                            selectedRunId={model2?.runId}
                            paramName="model2"
                            rankParamName="rank2"
                            label="Model 2"
                            navigation={model2}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-muted/50 rounded-lg border p-4">
                {!model1 || !model2 ? (
                    <div className="text-muted-foreground p-12 text-center text-sm">Select two models to compare.</div>
                ) : (
                    <>
                        <div className="bg-background h-[750px] w-full rounded-lg border">
                            <PredictionComparison
                                prediction1Route={model1.routeTree}
                                prediction2Route={model2.routeTree}
                                mode={displayMode}
                                inStockInchiKeys={stockInfo.inStockInchiKeys}
                                buyableMetadataMap={stockInfo.buyableMetadataMap}
                                model1Label={model1.name}
                                model2Label={model2.name}
                            />
                        </div>
                        <div className="mt-4 flex justify-end">
                            <RouteLegend viewMode={displayMode} isPredictionComparison />
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
