import Link from 'next/link'

import type { TargetComparisonData } from '@/types'
import { RoutePagination } from '@/components/route-pagination'
import { PredictionComparison, RouteComparison, RouteGraph, RouteLegend } from '@/components/route-visualization'
import { Button } from '@/components/ui/button'

import { ComparisonModeTabs } from '../client/comparison-mode-tabs'
import { ModelPredictionSelector } from '../client/model-prediction-selector'
import { RouteJsonViewer } from '../client/route-json-viewer'

interface RouteDisplayWithComparisonProps {
    data: TargetComparisonData
}

function NoAcceptableRoute() {
    return (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
            No acceptable routes available for this target
        </div>
    )
}

/**
 * Main server component for route display with comparison support.
 * This is now a "dumb" component that just renders the pre-fetched TargetComparisonData DTO.
 */
export function RouteDisplayWithComparison({ data }: RouteDisplayWithComparisonProps) {
    const {
        currentMode,
        displayMode,
        availableRuns,
        acceptableRoute,
        totalAcceptableRoutes,
        currentAcceptableIndex,
        model1,
        model2,
        stockInfo,
    } = data

    const hasMultipleAcceptableRoutes = totalAcceptableRoutes > 1

    return (
        <ComparisonModeTabs currentMode={currentMode} hasAcceptableRoutes={!!acceptableRoute}>
            {{
                gtOnly: (
                    <div className="space-y-4">
                        {hasMultipleAcceptableRoutes && acceptableRoute && (
                            <div className="rounded-lg border bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                                <RoutePagination
                                    paramName="acceptableIndex"
                                    currentValue={currentAcceptableIndex}
                                    maxValue={totalAcceptableRoutes}
                                    label="Route"
                                    zeroBasedIndex={true}
                                />
                            </div>
                        )}
                        <div className="rounded-lg border bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                            {!acceptableRoute ? (
                                <NoAcceptableRoute />
                            ) : (
                                <>
                                    <div className="mb-4">
                                        <h2 className="text-lg font-semibold">
                                            Acceptable Route
                                            {hasMultipleAcceptableRoutes &&
                                                ` ${currentAcceptableIndex + 1} of ${totalAcceptableRoutes}`}
                                        </h2>
                                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                            {`Synthesis route with ${acceptableRoute.route.length} steps${acceptableRoute.route.isConvergent ? ' (convergent)' : ''}`}
                                        </p>
                                    </div>
                                    <div className="h-[750px] w-full rounded-lg border bg-white dark:border-gray-800 dark:bg-gray-950">
                                        <RouteGraph
                                            route={acceptableRoute.visualizationNode}
                                            inStockInchiKeys={stockInfo.inStockInchiKeys}
                                            buyableMetadataMap={stockInfo.buyableMetadataMap}
                                            idPrefix="acceptable-route-"
                                            preCalculatedNodes={acceptableRoute.layout?.nodes}
                                            preCalculatedEdges={acceptableRoute.layout?.edges}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <RouteLegend viewMode="prediction-only" />
                                    </div>
                                    <details className="mt-4 text-sm">
                                        <summary className="cursor-pointer font-medium">View JSON (debug)</summary>
                                        <div className="mt-4">
                                            <RouteJsonViewer routeData={acceptableRoute.data} />
                                        </div>
                                    </details>
                                </>
                            )}
                        </div>
                    </div>
                ),
                gtVsPred: (
                    <div className="space-y-4">
                        <div className="rounded-lg border bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                            <div className="space-y-3">
                                {model1 && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">Comparison View:</span>
                                        <div className="flex gap-1">
                                            <Button
                                                variant={displayMode === 'side-by-side' ? 'default' : 'outline'}
                                                size="sm"
                                                asChild
                                            >
                                                <Link
                                                    href={`?mode=${currentMode}&model1=${model1.runId}&rank1=${model1.rank}&view=side-by-side`}
                                                    scroll={false}
                                                >
                                                    Side-by-Side
                                                </Link>
                                            </Button>
                                            <Button
                                                variant={displayMode === 'diff-overlay' ? 'default' : 'outline'}
                                                size="sm"
                                                asChild
                                            >
                                                <Link
                                                    href={`?mode=${currentMode}&model1=${model1.runId}&rank1=${model1.rank}&view=diff-overlay`}
                                                    scroll={false}
                                                >
                                                    Diff Overlay
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-3">
                                        <div className="flex h-9 items-center">
                                            <span className="text-sm font-medium">Acceptable Route</span>
                                        </div>
                                        {hasMultipleAcceptableRoutes && (
                                            <RoutePagination
                                                paramName="acceptableIndex"
                                                currentValue={currentAcceptableIndex}
                                                maxValue={totalAcceptableRoutes}
                                                label="Route"
                                                zeroBasedIndex={true}
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        <ModelPredictionSelector
                                            runs={availableRuns}
                                            paramName="model1"
                                            label="Model Prediction"
                                            selectedRunId={model1?.runId}
                                        />
                                        {model1 && (
                                            <RoutePagination
                                                paramName="rank1"
                                                currentValue={model1.rank}
                                                maxValue={model1.maxRank}
                                                label="Rank"
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-lg border bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                            {!model1 ? (
                                <div className="p-4 text-center text-sm">Select a model to compare</div>
                            ) : (
                                <div className="h-[750px] w-full rounded-lg border bg-white dark:border-gray-800 dark:bg-gray-950">
                                    {acceptableRoute && (
                                        <RouteComparison
                                            acceptableRoute={acceptableRoute.visualizationNode}
                                            predictionRoute={model1.routeTree}
                                            mode={displayMode}
                                            inStockInchiKeys={stockInfo.inStockInchiKeys}
                                            buyableMetadataMap={stockInfo.buyableMetadataMap}
                                            modelName={model1.name}
                                            acceptableRouteLabel={
                                                hasMultipleAcceptableRoutes
                                                    ? `Acceptable Route ${currentAcceptableIndex + 1}`
                                                    : 'Acceptable Route'
                                            }
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ),
                predVsPred: (
                    <div className="space-y-4">
                        <div className="rounded-lg border bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                            <div className="space-y-3">
                                {model1 && model2 && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">Comparison View:</span>
                                        <div className="flex gap-1">
                                            <Button
                                                variant={displayMode === 'side-by-side' ? 'default' : 'outline'}
                                                size="sm"
                                                asChild
                                            >
                                                <Link
                                                    href={`?mode=${currentMode}&model1=${model1.runId}&rank1=${model1.rank}&model2=${model2.runId}&rank2=${model2.rank}&view=side-by-side`}
                                                    scroll={false}
                                                >
                                                    Side-by-Side
                                                </Link>
                                            </Button>
                                            <Button
                                                variant={displayMode === 'diff-overlay' ? 'default' : 'outline'}
                                                size="sm"
                                                asChild
                                            >
                                                <Link
                                                    href={`?mode=${currentMode}&model1=${model1.runId}&rank1=${model1.rank}&model2=${model2.runId}&rank2=${model2.rank}&view=diff-overlay`}
                                                    scroll={false}
                                                >
                                                    Diff Overlay
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-3">
                                        <ModelPredictionSelector
                                            runs={availableRuns}
                                            paramName="model1"
                                            label="Model 1"
                                            selectedRunId={model1?.runId}
                                        />
                                        {model1 && (
                                            <RoutePagination
                                                paramName="rank1"
                                                currentValue={model1.rank}
                                                maxValue={model1.maxRank}
                                                label="Rank"
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        <ModelPredictionSelector
                                            runs={availableRuns}
                                            paramName="model2"
                                            label="Model 2"
                                            selectedRunId={model2?.runId}
                                        />
                                        {model2 && (
                                            <RoutePagination
                                                paramName="rank2"
                                                currentValue={model2.rank}
                                                maxValue={model2.maxRank}
                                                label="Rank"
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-lg border bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                            {!model1 || !model2 ? (
                                <div className="p-4 text-center text-sm">Select two models to compare</div>
                            ) : (
                                <div className="h-[750px] w-full rounded-lg border bg-white dark:border-gray-800 dark:bg-gray-950">
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
                            )}
                        </div>
                    </div>
                ),
            }}
        </ComparisonModeTabs>
    )
}
