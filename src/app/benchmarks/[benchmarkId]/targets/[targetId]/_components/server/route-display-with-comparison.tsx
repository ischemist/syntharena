import Link from 'next/link'

import type { RouteNodeWithDetails, RouteVisualizationNode } from '@/types'
import { getAllRouteInchiKeysSet } from '@/lib/route-visualization'
import * as benchmarkService from '@/lib/services/benchmark.service'
import * as routeService from '@/lib/services/route.service'
import * as stockService from '@/lib/services/stock.service'
import { PredictionComparison, RouteComparison, RouteGraph, RouteLegend } from '@/components/route-visualization'
import { Button } from '@/components/ui/button'

import { AcceptableRoutePagination } from '../client/acceptable-route-pagination'
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
    acceptableIndex?: number
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
 * No acceptable routes available message.
 */
function NoAcceptableRoute() {
    return (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
            No acceptable routes available for this target
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
    acceptableIndex: acceptableIndexProp,
}: RouteDisplayWithComparisonProps) {
    let acceptableRouteData
    let acceptableRouteTree: RouteVisualizationNode | undefined
    let model1RouteTree: RouteVisualizationNode | undefined
    let model2RouteTree: RouteVisualizationNode | undefined
    let hasError = false
    let inStockInchiKeys = new Set<string>()
    let availableRuns: Array<{
        id: string
        modelName: string
        modelVersion?: string
        algorithmName: string
        executedAt: Date
        routeCount: number
        maxRank: number
    }> = []
    let acceptableIndex = 0
    let totalAcceptableRoutes = 0
    let hasMultipleAcceptableRoutes = false

    // Phase 3: Pre-calculated layout for server-side rendering (acceptable-route-only mode)
    let acceptableRouteLayout:
        | {
              nodes: Array<{ id: string; smiles: string; inchikey: string; x: number; y: number }>
              edges: Array<{ source: string; target: string }>
          }
        | undefined

    // Model metadata extracted from availableRuns
    let model1MaxRank = 0
    let model2MaxRank = 0
    let model1Name = ''
    let model2Name = ''

    // OPTIMIZATION: Batch 1 - Initial parallel fetch (independent queries)
    try {
        const [benchmarkResult, availableRunsResult] = await Promise.all([
            benchmarkService.getBenchmarkById(benchmarkId),
            benchmarkService.getPredictionRunsForTarget(targetId),
        ])
        const benchmark = benchmarkResult
        availableRuns = availableRunsResult

        // OPTIMIZATION: Batch 2 - Acceptable route data (fetch selected route by index)
        // Phase 3: Fetch pre-calculated layout instead of just tree
        const acceptableRoutes = await routeService.getAcceptableRoutesForTarget(targetId)

        // Validate and clamp acceptableIndex to valid range
        acceptableIndex = Math.min(Math.max(0, acceptableIndexProp ?? 0), Math.max(0, acceptableRoutes.length - 1))

        const selectedAcceptableRoute = acceptableRoutes.find((ar) => ar.routeIndex === acceptableIndex)
        const selectedAcceptableRouteId = selectedAcceptableRoute?.route.id
        totalAcceptableRoutes = acceptableRoutes.length
        hasMultipleAcceptableRoutes = totalAcceptableRoutes > 1

        const acceptableRoutePromises = selectedAcceptableRouteId
            ? Promise.all([
                  routeService.getAcceptableRouteData(selectedAcceptableRouteId, targetId),
                  routeService.getRouteTreeForVisualization(selectedAcceptableRouteId),
                  routeService.getRouteTreeWithLayout(selectedAcceptableRouteId, 'acceptable-route-'),
              ])
            : Promise.resolve([null, null, null] as const)

        // OPTIMIZATION: Batch 3 - Model predictions (parallel)
        const predictionPromises = Promise.all([
            model1Id ? benchmarkService.getPredictedRouteForTarget(targetId, model1Id, rank1) : Promise.resolve(null),
            model2Id ? benchmarkService.getPredictedRouteForTarget(targetId, model2Id, rank2) : Promise.resolve(null),
        ])

        // OPTIMIZATION: Batch 4 - Stock data (already loaded in benchmark relation)
        // Phase 9: No runtime lookup needed - stock is already included
        const stockData = benchmark.stock

        // Await all parallel batches
        const [[acceptableData, acceptableTree, acceptableLayout], [model1Result, model2Result]] = await Promise.all([
            acceptableRoutePromises,
            predictionPromises,
        ])

        // Assign results
        acceptableRouteData = acceptableData ?? undefined
        acceptableRouteTree = acceptableTree ?? undefined
        acceptableRouteLayout = acceptableLayout ?? undefined

        if (model1Result) {
            model1RouteTree = convertToVisualizationNode(model1Result)
        }
        if (model2Result) {
            model2RouteTree = convertToVisualizationNode(model2Result)
        }

        // Extract model metadata from available runs
        const model1Run = availableRuns.find((run) => run.id === model1Id)
        const model2Run = availableRuns.find((run) => run.id === model2Id)

        model1MaxRank = model1Run?.maxRank ?? 0
        model2MaxRank = model2Run?.maxRank ?? 0
        model1Name = model1Run ? `${model1Run.modelName} (${model1Run.algorithmName})` : ''
        model2Name = model2Run ? `${model2Run.modelName} (${model2Run.algorithmName})` : ''

        // Collect InChiKeys and check stock (only if we have stock data)
        if (stockData) {
            const allInchiKeys = new Set<string>()
            if (acceptableRouteTree) {
                getAllRouteInchiKeysSet(acceptableRouteTree).forEach((key) => allInchiKeys.add(key))
            }
            if (model1RouteTree) {
                getAllRouteInchiKeysSet(model1RouteTree).forEach((key) => allInchiKeys.add(key))
            }
            if (model2RouteTree) {
                getAllRouteInchiKeysSet(model2RouteTree).forEach((key) => allInchiKeys.add(key))
            }

            try {
                inStockInchiKeys = await stockService.checkMoleculesInStockByInchiKey(
                    Array.from(allInchiKeys),
                    stockData.id
                )
            } catch (error) {
                console.warn('Failed to check stock availability:', error)
            }
        }
    } catch (error) {
        console.error('Failed to load route display:', error)
        hasError = true
    }

    // Determine current mode - URL is the single source of truth
    // Default to pred-vs-pred when no acceptable routes are available
    const validModes: ComparisonMode[] = ['gt-only', 'gt-vs-pred', 'pred-vs-pred']
    const mode: ComparisonMode =
        modeProp && validModes.includes(modeProp as ComparisonMode)
            ? (modeProp as ComparisonMode)
            : acceptableRouteTree
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
        <ComparisonModeTabs currentMode={mode} hasAcceptableRoutes={!!acceptableRouteTree}>
            {{
                gtOnly: (
                    <div className="space-y-4">
                        {/* Acceptable route selector (only if multiple routes) */}
                        {hasMultipleAcceptableRoutes && acceptableRouteTree && (
                            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                                <AcceptableRoutePagination
                                    currentIndex={acceptableIndex}
                                    totalRoutes={totalAcceptableRoutes}
                                    label="Acceptable Route"
                                />
                            </div>
                        )}

                        {/* Visualization */}
                        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                            {!acceptableRouteTree ? (
                                <NoAcceptableRoute />
                            ) : (
                                <>
                                    <div className="mb-4">
                                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                            Acceptable Route
                                            {hasMultipleAcceptableRoutes &&
                                                ` ${acceptableIndex + 1} of ${totalAcceptableRoutes}`}
                                        </h2>
                                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                            {acceptableRouteData &&
                                                `Synthesis route with ${acceptableRouteData.route.length} steps${acceptableRouteData.route.isConvergent ? ' (convergent)' : ''}`}
                                            {acceptableIndex === 0 && ' (Primary)'}
                                        </p>
                                    </div>

                                    <div className="h-[750px] w-full rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                                        <RouteGraph
                                            route={acceptableRouteTree}
                                            inStockInchiKeys={inStockInchiKeys}
                                            idPrefix="acceptable-route-"
                                            preCalculatedNodes={acceptableRouteLayout?.nodes}
                                            preCalculatedEdges={acceptableRouteLayout?.edges}
                                        />
                                    </div>

                                    <div className="mt-4">
                                        <RouteLegend viewMode="prediction-only" />
                                    </div>

                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        Scroll to zoom. Drag to pan. Nodes marked in green are in stock.
                                    </p>

                                    {acceptableRouteData && (
                                        <details className="mt-4 text-sm">
                                            <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
                                                View JSON (debug)
                                            </summary>
                                            <div className="mt-4">
                                                <RouteJsonViewer routeData={acceptableRouteData} />
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
                                {/* Acceptable route selector (if multiple routes) */}
                                {hasMultipleAcceptableRoutes && (
                                    <>
                                        <AcceptableRoutePagination
                                            currentIndex={acceptableIndex}
                                            totalRoutes={totalAcceptableRoutes}
                                            label="Acceptable Route"
                                        />
                                        <div className="border-t border-gray-200 pt-3 dark:border-gray-700" />
                                    </>
                                )}

                                {model1Id && acceptableRouteTree && model1RouteTree && (
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

                                {model1Id && acceptableRouteTree && model1RouteTree && (
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
                                    Select a model to compare with acceptable route
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
                                        {acceptableRouteTree && (
                                            <RouteComparison
                                                groundTruthRoute={acceptableRouteTree}
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
                                    {!model1RouteTree && <p>No prediction found for Model 1 rank {rank1}</p>}
                                    {!model2RouteTree && <p>No prediction found for Model 2 rank {rank2}</p>}
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
