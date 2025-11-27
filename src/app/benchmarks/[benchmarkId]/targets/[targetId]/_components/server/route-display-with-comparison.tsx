import Link from 'next/link'

import type { RouteNodeWithDetails, RouteVisualizationNode } from '@/types'
import { getAllRouteInchiKeysSet } from '@/lib/route-visualization'
import * as benchmarkService from '@/lib/services/benchmark.service'
import * as routeService from '@/lib/services/route.service'
import { findMatchingStock } from '@/lib/services/stock-mapping'
import * as stockService from '@/lib/services/stock.service'
import { PredictionComparison, RouteComparison, RouteGraph, RouteLegend } from '@/components/route-visualization'
import { Button } from '@/components/ui/button'

import { ComparisonModeTabs, type ComparisonMode } from '../client/comparison-mode-tabs'
import { ModelPredictionSelector } from '../client/model-prediction-selector'
import { RankPagination } from '../client/rank-pagination'
import { RouteJsonViewer } from '../client/route-json-viewer'

interface RouteDisplayWithComparisonProps {
    targetId: string
    benchmarkId: string
    mode?: string
    model1Id?: string
    model2Id?: string
    rank1: number
    rank2: number
    viewMode?: string
}

/**
 * Error component for visualization failures.
 */
function RouteVisualizationError() {
    return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            Failed to load route visualization. Please try again.
        </div>
    )
}

/**
 * No ground truth available message.
 */
function NoGroundTruthRoute() {
    return (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
            No ground truth route available for this target
        </div>
    )
}

/**
 * Convert RouteNodeWithDetails to RouteVisualizationNode format.
 */
function convertToVisualizationNode(node: RouteNodeWithDetails): RouteVisualizationNode {
    return {
        smiles: node.molecule.smiles,
        inchikey: node.molecule.inchikey,
        children: node.children.length > 0 ? node.children.map(convertToVisualizationNode) : undefined,
    }
}

/**
 * Main server component for route display with comparison support.
 * Handles ground truth and model prediction visualization with tab-based UI.
 */
export async function RouteDisplayWithComparison({
    targetId,
    benchmarkId,
    mode: modeProp,
    model1Id,
    model2Id,
    rank1,
    rank2,
    viewMode: viewModeProp,
}: RouteDisplayWithComparisonProps) {
    let target
    let groundTruthRouteData
    let groundTruthRouteTree: RouteVisualizationNode | undefined
    let model1RouteTree: RouteVisualizationNode | undefined
    let model2RouteTree: RouteVisualizationNode | undefined
    let model1MaxRank = 0
    let model2MaxRank = 0
    let hasError = false
    let inStockInchiKeys = new Set<string>()

    // Fetch target and ground truth
    try {
        target = await benchmarkService.getTargetById(targetId)

        if (target.groundTruthRouteId) {
            groundTruthRouteData = await routeService.getRouteTreeData(target.groundTruthRouteId)
            groundTruthRouteTree = await routeService.getRouteTreeForVisualization(target.groundTruthRouteId)
        }

        // Fetch model predictions if selected
        if (model1Id) {
            const result = await benchmarkService.getPredictedRouteForTarget(targetId, model1Id, rank1)
            if (result) {
                model1RouteTree = convertToVisualizationNode(result)
            }
        }

        if (model2Id) {
            const result = await benchmarkService.getPredictedRouteForTarget(targetId, model2Id, rank2)
            if (result) {
                model2RouteTree = convertToVisualizationNode(result)
            }
        }

        // Get stock info for all routes
        const benchmark = await benchmarkService.getBenchmarkById(benchmarkId)
        if (benchmark.stockName) {
            try {
                const stocks = await stockService.getStocks()
                const matchingStock = findMatchingStock(benchmark.stockName, stocks)

                if (matchingStock) {
                    // Collect all InChiKeys from all routes
                    const allInchiKeys = new Set<string>()
                    if (groundTruthRouteTree) {
                        getAllRouteInchiKeysSet(groundTruthRouteTree).forEach((key) => allInchiKeys.add(key))
                    }
                    if (model1RouteTree) {
                        getAllRouteInchiKeysSet(model1RouteTree).forEach((key) => allInchiKeys.add(key))
                    }
                    if (model2RouteTree) {
                        getAllRouteInchiKeysSet(model2RouteTree).forEach((key) => allInchiKeys.add(key))
                    }

                    inStockInchiKeys = await stockService.checkMoleculesInStockByInchiKey(
                        Array.from(allInchiKeys),
                        matchingStock.id
                    )
                }
            } catch (error) {
                console.warn('Failed to check stock availability:', error)
            }
        }
    } catch (error) {
        console.error('Failed to load route display:', error)
        hasError = true
    }

    // Fetch available prediction runs for THIS target (with max ranks)
    const availableRuns = await benchmarkService.getPredictionRunsForTarget(targetId)

    // Get max ranks and model names for selected models
    let model1Name = ''
    let model2Name = ''

    if (model1Id) {
        const run = availableRuns.find((r) => r.id === model1Id)
        model1MaxRank = run?.maxRank || 50
        model1Name = run ? `${run.modelName}${run.modelVersion ? ` v${run.modelVersion}` : ''}` : 'Model 1'
    }
    if (model2Id) {
        const run = availableRuns.find((r) => r.id === model2Id)
        model2MaxRank = run?.maxRank || 50
        model2Name = run ? `${run.modelName}${run.modelVersion ? ` v${run.modelVersion}` : ''}` : 'Model 2'
    }

    // Determine current mode - URL is the single source of truth
    // Default to pred-vs-pred when no ground truth is available
    const validModes: ComparisonMode[] = ['gt-only', 'gt-vs-pred', 'pred-vs-pred']
    const mode: ComparisonMode =
        modeProp && validModes.includes(modeProp as ComparisonMode)
            ? (modeProp as ComparisonMode)
            : groundTruthRouteTree
              ? 'gt-only'
              : 'pred-vs-pred'

    // Determine view mode for comparison (only side-by-side and diff-overlay for comparisons)
    const validViewModes = ['side-by-side', 'diff-overlay'] as const
    type ComparisonViewMode = (typeof validViewModes)[number]
    const viewMode: ComparisonViewMode =
        viewModeProp && validViewModes.includes(viewModeProp as ComparisonViewMode)
            ? (viewModeProp as ComparisonViewMode)
            : 'side-by-side'

    if (hasError) {
        return <RouteVisualizationError />
    }

    // Render tab-based UI
    return (
        <ComparisonModeTabs currentMode={mode} hasGroundTruth={!!groundTruthRouteTree}>
            {{
                gtOnly: (
                    <div className="space-y-4">
                        {/* Visualization */}
                        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                            {!groundTruthRouteTree ? (
                                <NoGroundTruthRoute />
                            ) : (
                                <>
                                    <div className="mb-4">
                                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                            Ground Truth Route
                                        </h2>
                                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                            {groundTruthRouteData &&
                                                `Synthesis route with ${groundTruthRouteData.route.length} steps${groundTruthRouteData.route.isConvergent ? ' (convergent)' : ''}`}
                                        </p>
                                    </div>

                                    <div className="h-[750px] w-full rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                                        <RouteGraph
                                            route={groundTruthRouteTree}
                                            inStockInchiKeys={inStockInchiKeys}
                                            idPrefix="gt-route-"
                                        />
                                    </div>

                                    <div className="mt-4">
                                        <RouteLegend viewMode="prediction-only" />
                                    </div>

                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        Scroll to zoom. Drag to pan. Nodes marked in green are in stock.
                                    </p>

                                    {groundTruthRouteData && (
                                        <details className="mt-4 text-sm">
                                            <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
                                                View JSON (debug)
                                            </summary>
                                            <div className="mt-4">
                                                <RouteJsonViewer routeData={groundTruthRouteData} />
                                            </div>
                                        </details>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                ),

                gtVsPred: (
                    <div className="space-y-4">
                        {/* Model selector */}
                        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                            <div className="space-y-3">
                                {model1Id && groundTruthRouteTree && model1RouteTree && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Comparison View:
                                        </span>
                                        <div className="flex gap-1">
                                            <Button
                                                variant={viewMode === 'side-by-side' ? 'default' : 'outline'}
                                                size="sm"
                                                asChild
                                            >
                                                <Link
                                                    href={`?mode=${mode}&model1=${model1Id}&rank1=${rank1}&view=side-by-side`}
                                                    scroll={false}
                                                >
                                                    Side-by-Side
                                                </Link>
                                            </Button>
                                            <Button
                                                variant={viewMode === 'diff-overlay' ? 'default' : 'outline'}
                                                size="sm"
                                                asChild
                                            >
                                                <Link
                                                    href={`?mode=${mode}&model1=${model1Id}&rank1=${rank1}&view=diff-overlay`}
                                                    scroll={false}
                                                >
                                                    Diff Overlay
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {model1Id && groundTruthRouteTree && model1RouteTree && (
                                    <div className="border-t border-gray-200 pt-3 dark:border-gray-700" />
                                )}

                                <ModelPredictionSelector
                                    runs={availableRuns}
                                    paramName="model1"
                                    label="Model Prediction"
                                    selectedRunId={model1Id}
                                />

                                {model1Id && model1RouteTree && (
                                    <RankPagination
                                        paramName="rank1"
                                        currentRank={rank1}
                                        maxRank={model1MaxRank}
                                        label="Route Rank"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Visualization */}
                        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                            {!model1Id ? (
                                <div className="p-4 text-center text-sm text-gray-600 dark:text-gray-400">
                                    Select a model to compare with ground truth
                                </div>
                            ) : !model1RouteTree ? (
                                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
                                    No prediction found for rank {rank1}
                                </div>
                            ) : (
                                <>
                                    <div className="mb-4">
                                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                            Route Comparison
                                        </h2>
                                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                            {viewMode === 'side-by-side'
                                                ? 'Side-by-side comparison'
                                                : 'Overlay comparison with differences highlighted'}
                                        </p>
                                    </div>

                                    <div className="h-[750px] w-full rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                                        {groundTruthRouteTree && (
                                            <RouteComparison
                                                groundTruthRoute={groundTruthRouteTree}
                                                predictionRoute={model1RouteTree}
                                                mode={viewMode}
                                                inStockInchiKeys={inStockInchiKeys}
                                                modelName={model1Name}
                                            />
                                        )}
                                    </div>

                                    <div className="mt-4">
                                        <RouteLegend viewMode={viewMode} />
                                    </div>

                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        {viewMode === 'side-by-side'
                                            ? 'Scroll to zoom. Drag to pan. Green = match, amber = extension (unique to one route).'
                                            : 'Scroll to zoom. Drag to pan. Green = match, amber = extension, dashed gray = missing from second route.'}
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                ),

                predVsPred: (
                    <div className="space-y-4">
                        {/* Model selectors */}
                        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                            <div className="space-y-3">
                                {model1Id && model2Id && model1RouteTree && model2RouteTree && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Comparison View:
                                        </span>
                                        <div className="flex gap-1">
                                            <Button
                                                variant={viewMode === 'side-by-side' ? 'default' : 'outline'}
                                                size="sm"
                                                asChild
                                            >
                                                <Link
                                                    href={`?mode=${mode}&model1=${model1Id}&rank1=${rank1}&model2=${model2Id}&rank2=${rank2}&view=side-by-side`}
                                                    scroll={false}
                                                >
                                                    Side-by-Side
                                                </Link>
                                            </Button>
                                            <Button
                                                variant={viewMode === 'diff-overlay' ? 'default' : 'outline'}
                                                size="sm"
                                                asChild
                                            >
                                                <Link
                                                    href={`?mode=${mode}&model1=${model1Id}&rank1=${rank1}&model2=${model2Id}&rank2=${rank2}&view=diff-overlay`}
                                                    scroll={false}
                                                >
                                                    Diff Overlay
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {model1Id && model2Id && model1RouteTree && model2RouteTree && (
                                    <div className="border-t border-gray-200 pt-3 dark:border-gray-700" />
                                )}

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-3">
                                        <ModelPredictionSelector
                                            runs={availableRuns}
                                            paramName="model1"
                                            label="Model 1"
                                            selectedRunId={model1Id}
                                        />

                                        {model1Id && model1RouteTree && (
                                            <RankPagination
                                                paramName="rank1"
                                                currentRank={rank1}
                                                maxRank={model1MaxRank}
                                                label="Model 1 Rank"
                                            />
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <ModelPredictionSelector
                                            runs={availableRuns}
                                            paramName="model2"
                                            label="Model 2"
                                            selectedRunId={model2Id}
                                        />

                                        {model2Id && model2RouteTree && (
                                            <RankPagination
                                                paramName="rank2"
                                                currentRank={rank2}
                                                maxRank={model2MaxRank}
                                                label="Model 2 Rank"
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Visualization */}
                        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                            {!model1Id && !model2Id ? (
                                <div className="p-4 text-center text-sm text-gray-600 dark:text-gray-400">
                                    Select two models to compare their predictions
                                </div>
                            ) : !model1Id || !model2Id ? (
                                <div className="p-4 text-center text-sm text-gray-600 dark:text-gray-400">
                                    Select a second model to compare
                                </div>
                            ) : !model1RouteTree || !model2RouteTree ? (
                                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
                                    {!model1RouteTree && `No prediction found for Model 1 rank ${rank1}`}
                                    {!model2RouteTree && `No prediction found for Model 2 rank ${rank2}`}
                                </div>
                            ) : (
                                <>
                                    <div className="mb-4">
                                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                            Prediction Comparison
                                        </h2>
                                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                            {viewMode === 'side-by-side'
                                                ? 'Side-by-side comparison'
                                                : 'Overlay comparison with differences highlighted'}
                                        </p>
                                    </div>

                                    <div className="h-[750px] w-full rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                                        <PredictionComparison
                                            prediction1Route={model1RouteTree}
                                            prediction2Route={model2RouteTree}
                                            mode={viewMode}
                                            inStockInchiKeys={inStockInchiKeys}
                                            model1Label={model1Name}
                                            model2Label={model2Name}
                                        />
                                    </div>

                                    <div className="mt-4">
                                        <RouteLegend viewMode={viewMode} isPredictionComparison={true} />
                                    </div>

                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        {viewMode === 'side-by-side'
                                            ? 'Scroll to zoom. Drag to pan. Teal = both routes, sky = Model 1 only, violet = Model 2 only.'
                                            : 'Scroll to zoom. Drag to pan. Teal = both routes, sky = Model 1 only, violet (dashed) = Model 2 only.'}
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                ),
            }}
        </ComparisonModeTabs>
    )
}
