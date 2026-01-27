import type { TargetComparisonData } from '@/types'
import { DeveloperModeToggle } from '@/components/developer-mode-toggle'
import { CompactRankNavigator, ControlGrid, ControlGridSlot, ModelSelector } from '@/components/navigation'
import { RouteComparison, RouteLegend } from '@/components/route-visualization'

import { LayoutModeToggle } from '../client/layout-mode-toggle'

interface GroundTruthComparisonViewProps {
    data: TargetComparisonData
}

/** a dedicated view for comparing an acceptable route vs. a model prediction. */
export function GroundTruthComparisonView({ data }: GroundTruthComparisonViewProps) {
    const { acceptableRoute, model1, availableRuns, layout, stockInfo } = data

    return (
        <div className="space-y-4">
            <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
                <DeveloperModeToggle />
                {/* section 1: the selection grid */}
                <ControlGrid>
                    <ControlGridSlot label="Acceptable Route:">
                        <CompactRankNavigator
                            paramName="acceptableIndex"
                            currentRank={data.currentAcceptableIndex}
                            rankCount={data.totalAcceptableRoutes}
                            availableRanks={acceptableRoute?.availableRanks ?? []}
                            isZeroBased
                        />
                    </ControlGridSlot>
                    <ControlGridSlot label="Model Prediction:">
                        {/* no extra div needed; the slot's flex-col will stack these */}
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
                </ControlGrid>

                {/* section 2: the view options bar */}
                {model1 && (
                    <div className="border-border/50 flex items-center justify-between border-t pt-3">
                        <span className="text-muted-foreground text-sm font-medium">Comparison View:</span>
                        <LayoutModeToggle currentLayout={layout} />
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
                                mode={layout}
                                inStockInchiKeys={stockInfo.inStockInchiKeys}
                                buyableMetadataMap={stockInfo.buyableMetadataMap}
                                modelName={model1.name}
                                acceptableRouteLabel={`Acceptable Route ${data.currentAcceptableIndex + 1}`}
                            />
                        </div>
                        <div className="mt-4 flex justify-end">
                            <RouteLegend viewMode={layout} />
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
