import { Suspense } from 'react'

import type { BuyableMetadata } from '@/types'
import { getAllRouteInchiKeysSet } from '@/lib/route-visualization'
import * as stockData from '@/lib/services/data/stock.data'
import * as routeService from '@/lib/services/route.service'
import * as benchmarkView from '@/lib/services/view/benchmark.view'
import * as stockView from '@/lib/services/view/stock.view'
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

function NoAcceptableRoute() {
    return (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            No acceptable routes available for this target
        </div>
    )
}

async function RouteVisualizationContent({ routeId, benchmarkId }: { routeId: string; benchmarkId: string }) {
    // Fetch visualization tree
    const routeTree = await routeService.getRouteTreeForVisualization(routeId)

    // Get benchmark to find stock ID if available
    const benchmark = await benchmarkView.getBenchmarkById(benchmarkId)

    // Collect all InChiKeys from route for stock checking
    const allInchiKeys = Array.from(getAllRouteInchiKeysSet(routeTree))

    // Phase 9: Check stock availability using direct stock relation (no fuzzy matching)
    let inStockInchiKeys = new Set<string>()
    let buyableMetadataMap = new Map<string, BuyableMetadata>()
    if (benchmark.stock) {
        try {
            inStockInchiKeys = await stockData.findInchiKeysInStock(allInchiKeys, benchmark.stock.id)
            buyableMetadataMap = await stockView.getBuyableMetadataMap(allInchiKeys, benchmark.stock.id)
            console.log(`[Route Visualization] Checking stock availability for "${benchmark.stock.name}"`)
        } catch (error) {
            console.warn('Failed to check stock availability:', error)
        }
    }

    return (
        <RouteVisualizationWrapper
            routeTree={routeTree}
            inStockInchiKeys={inStockInchiKeys}
            buyableMetadataMap={buyableMetadataMap}
        />
    )
}

/**
 * Server component that fetches and displays route information.
 * Renders visualization with streaming and Suspense boundaries.
 */
export async function RouteDisplay({ targetId }: RouteDisplayProps) {
    let target
    let routeData
    let hasError = false
    let primaryAcceptableRouteId: string | undefined

    // Fetch data outside of JSX construction
    try {
        target = await benchmarkView.getTargetById(targetId)

        // Fetch acceptable routes to get the primary route (index 0)
        const acceptableRoutes = await routeService.getAcceptableRoutesForTarget(targetId)
        const primaryRoute = acceptableRoutes.find((ar) => ar.routeIndex === 0)
        primaryAcceptableRouteId = primaryRoute?.route.id

        // Fetch complete route data for JSON viewer
        if (primaryAcceptableRouteId) {
            routeData = await routeService.getAcceptableRouteData(primaryAcceptableRouteId, targetId)
        }
    } catch (error) {
        console.error('Failed to load route display:', error)
        hasError = true
    }

    // Render JSX after data is fetched
    if (hasError) {
        return <RouteVisualizationError />
    }

    if (!primaryAcceptableRouteId) {
        return <NoAcceptableRoute />
    }

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Acceptable Route</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {routeData &&
                        `Synthesis route with ${routeData.route.length} steps${routeData.route.isConvergent ? ' (convergent)' : ''}`}
                </p>
            </div>

            <Suspense fallback={<RouteVisualizationSkeleton />}>
                <RouteVisualizationContent routeId={primaryAcceptableRouteId} benchmarkId={target!.benchmarkSetId} />
            </Suspense>

            {/* Keep JSON viewer as fallback/debugging */}
            <details className="text-sm">
                <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
                    View JSON (debug)
                </summary>
                <div className="mt-4">
                    <RouteJsonViewer routeData={routeData!} />
                </div>
            </details>
        </div>
    )
}
