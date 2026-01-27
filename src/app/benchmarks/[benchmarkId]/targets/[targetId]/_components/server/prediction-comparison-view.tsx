import type { TargetComparisonData } from '@/types'
import { DeveloperModeToggle } from '@/components/developer-mode-toggle'
import { CompactRankNavigator, ControlGrid, ControlGridSlot, ModelSelector } from '@/components/navigation'
import { PredictionComparison, RouteLegend } from '@/components/route-visualization'

import { LayoutModeToggle } from '../client/layout-mode-toggle'

interface PredictionComparisonViewProps {
    data: TargetComparisonData
}

/** a dedicated view for comparing two model predictions. */
export function PredictionComparisonView({ data }: PredictionComparisonViewProps) {
    const { model1, model2, availableRuns, layout, stockInfo } = data

    return (
        <div className="space-y-4">
            <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
                <div className="flex justify-end">
                    <DeveloperModeToggle />
                </div>
                <ControlGrid>
                    <ControlGridSlot label="Model 1:">
                        <div className="flex items-center gap-2">
                            <ModelSelector
                                runs={availableRuns}
                                selectedRunId={model1?.runId}
                                paramName="model1"
                                rankParamName="rank1"
                            />
                            {model1 && (
                                <CompactRankNavigator
                                    paramName="rank1"
                                    currentRank={model1.rank}
                                    rankCount={model1.availableRanks.length}
                                    availableRanks={model1.availableRanks}
                                />
                            )}
                        </div>
                    </ControlGridSlot>
                    <ControlGridSlot label="Model 2:">
                        <div className="flex items-center gap-2">
                            <ModelSelector
                                runs={availableRuns}
                                selectedRunId={model2?.runId}
                                paramName="model2"
                                rankParamName="rank2"
                            />
                            {model2 && (
                                <CompactRankNavigator
                                    paramName="rank2"
                                    currentRank={model2.rank}
                                    rankCount={model2.availableRanks.length}
                                    availableRanks={model2.availableRanks}
                                />
                            )}
                        </div>
                    </ControlGridSlot>
                </ControlGrid>

                {model1 && model2 && (
                    <div className="border-border/50 flex items-center justify-between border-t pt-3">
                        <span className="text-muted-foreground text-sm font-medium">Comparison View:</span>
                        <LayoutModeToggle currentLayout={layout} />
                    </div>
                )}
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
                                mode={layout}
                                inStockInchiKeys={stockInfo.inStockInchiKeys}
                                buyableMetadataMap={stockInfo.buyableMetadataMap}
                                model1Label={model1.name}
                                model2Label={model2.name}
                            />
                        </div>
                        <div className="mt-4 flex justify-end">
                            <RouteLegend viewMode={layout} isPredictionComparison />
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
