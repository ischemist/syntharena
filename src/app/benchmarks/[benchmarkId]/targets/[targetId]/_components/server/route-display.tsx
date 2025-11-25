import { Suspense } from 'react'

import type { RouteVisualizationNode } from '@/types'
import * as benchmarkService from '@/lib/services/benchmark.service'
import * as routeService from '@/lib/services/route.service'
import { findMatchingStock } from '@/lib/services/stock-mapping'
import * as stockService from '@/lib/services/stock.service'
import { Skeleton } from '@/components/ui/skeleton'

import { RouteJsonViewer } from '../client/route-json-viewer'
import { RouteVisualizationWrapper } from '../client/route-visualization-wrapper'

interface RouteDisplayProps {
    targetId: string
}

/**
 * Skeleton loader for route visualization.
 * Shows placeholder while data is loading.
 */
function RouteVisualizationSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-[600px] w-full rounded-lg" />
        </div>
    )
}

/**
 * Async component that fetches route visualization data.
 * Handles data loading and passes to client wrapper.
 */
function RouteVisualizationError() {
    return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Failed to load route visualization. Please try again.
        </div>
    )
}

function NoGroundTruthRoute() {
    return (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            No ground truth route available for this target
        </div>
    )
}

async function RouteVisualizationContent({ routeId, benchmarkId }: { routeId: string; benchmarkId: string }) {
    // Fetch visualization tree
    const routeTree = await routeService.getRouteTreeForVisualization(routeId)

    // Get benchmark to find stock ID if available
    const benchmark = await benchmarkService.getBenchmarkById(benchmarkId)

    // Collect all SMILES from route for stock checking
    const allSmiles: string[] = []
    function collectSmiles(node: RouteVisualizationNode) {
        allSmiles.push(node.smiles)
        if (node.children) {
            node.children.forEach(collectSmiles)
        }
    }
    collectSmiles(routeTree)

    // Check stock availability if benchmark has a stock
    let inStockSmiles = new Set<string>()
    if (benchmark.stockName) {
        try {
            // Get all available stocks
            const stocks = await stockService.getStocks()

            // Use smart matching to find the stock
            const matchingStock = findMatchingStock(benchmark.stockName, stocks)

            if (matchingStock) {
                inStockSmiles = await stockService.checkMoleculesInStock(allSmiles, matchingStock.id)
                console.log(
                    `[Route Visualization] Matched benchmark stock "${benchmark.stockName}" to database stock "${matchingStock.name}"`
                )
            } else {
                console.warn(
                    `[Route Visualization] Could not find matching stock for benchmark "${benchmark.stockName}". Available: ${stocks.map((s) => s.name).join(', ')}`
                )
            }
        } catch (error) {
            console.warn('Failed to check stock availability:', error)
        }
    }

    return <RouteVisualizationWrapper routeTree={routeTree} inStockSmiles={inStockSmiles} />
}

/**
 * Server component that fetches and displays route information.
 * Renders visualization with streaming and Suspense boundaries.
 */
export async function RouteDisplay({ targetId }: RouteDisplayProps) {
    let target
    let routeData
    let hasError = false

    // Fetch data outside of JSX construction
    try {
        target = await benchmarkService.getTargetById(targetId)

        // Fetch complete route data for JSON viewer
        if (target.groundTruthRouteId) {
            routeData = await routeService.getRouteTreeData(target.groundTruthRouteId)
        }
    } catch (error) {
        console.error('Failed to load route display:', error)
        hasError = true
    }

    // Render JSX after data is fetched
    if (hasError) {
        return <RouteVisualizationError />
    }

    if (!target?.groundTruthRouteId) {
        return <NoGroundTruthRoute />
    }

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-gray-900">Ground Truth Route</h2>
                <p className="mt-1 text-sm text-gray-600">
                    Synthesis route with {routeData!.route.length} steps
                    {routeData!.route.isConvergent && ' (convergent)'}
                </p>
            </div>

            <Suspense fallback={<RouteVisualizationSkeleton />}>
                <RouteVisualizationContent routeId={target.groundTruthRouteId} benchmarkId={target.benchmarkSetId} />
            </Suspense>

            {/* Keep JSON viewer as fallback/debugging */}
            <details className="text-sm">
                <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-900">
                    View JSON (debug)
                </summary>
                <div className="mt-4">
                    <RouteJsonViewer routeData={routeData!} />
                </div>
            </details>
        </div>
    )
}
