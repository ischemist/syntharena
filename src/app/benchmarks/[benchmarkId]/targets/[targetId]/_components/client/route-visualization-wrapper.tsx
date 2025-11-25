'use client'

import type { RouteVisualizationNode } from '@/types'
import { RouteGraph, RouteLegend } from '@/components/route-visualization'

interface RouteVisualizationWrapperProps {
    routeTree: RouteVisualizationNode
    inStockSmiles: Set<string>
}

/**
 * Client-side wrapper for route visualization.
 * Thin component that composes shared route visualization components.
 * Page-specific concerns stay here, generic logic in shared components.
 *
 * Phase 1 features:
 * - Single route display
 * - Stock availability indicators
 * - Interactive pan/zoom
 */
export function RouteVisualizationWrapper({ routeTree, inStockSmiles }: RouteVisualizationWrapperProps) {
    return (
        <div className="space-y-4">
            {/* Legend */}
            <div className="flex justify-end">
                <RouteLegend />
            </div>

            {/* Visualization - tall for better tree exploration */}
            <div className="h-[600px] w-full rounded-lg border border-gray-200 bg-white">
                <RouteGraph route={routeTree} inStockSmiles={inStockSmiles} idPrefix="target-route-" />
            </div>

            {/* Info */}
            <p className="text-xs text-gray-500">Scroll to zoom. Drag to pan. Nodes marked in green are in stock.</p>
        </div>
    )
}
