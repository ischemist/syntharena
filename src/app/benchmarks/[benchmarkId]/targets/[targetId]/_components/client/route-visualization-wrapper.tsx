'use client'

import type { RouteVisualizationNode, VendorSource } from '@/types'
import { RouteGraph, RouteLegend } from '@/components/route-visualization'

type BuyableMetadata = {
    ppg: number | null
    source: VendorSource | null
    leadTime: string | null
    link: string | null
}

interface RouteVisualizationWrapperProps {
    routeTree: RouteVisualizationNode
    inStockInchiKeys: Set<string>
    buyableMetadataMap?: Map<string, BuyableMetadata>
}

/**
 * Client-side wrapper for route visualization.
 * Thin component that composes shared route visualization components.
 * Page-specific concerns stay here, generic logic in shared components.
 *
 * Phase 1 features:
 * - Single route display
 * - Stock availability indicators (using InChiKeys for reliable comparison)
 * - Interactive pan/zoom
 */
export function RouteVisualizationWrapper({
    routeTree,
    inStockInchiKeys,
    buyableMetadataMap,
}: RouteVisualizationWrapperProps) {
    return (
        <div className="space-y-4">
            {/* Legend */}
            <div className="flex justify-end">
                <RouteLegend />
            </div>

            {/* Visualization - tall for better tree exploration */}
            <div className="h-[750px] w-full rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                <RouteGraph
                    route={routeTree}
                    inStockInchiKeys={inStockInchiKeys}
                    buyableMetadataMap={buyableMetadataMap}
                    idPrefix="target-route-"
                />
            </div>

            {/* Info */}
            <p className="text-xs text-gray-500 dark:text-gray-400">
                Scroll to zoom. Drag to pan. Nodes marked in green are in stock.
            </p>
        </div>
    )
}
