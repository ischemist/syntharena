'use client'

/**
 * Legend showing status indicators for nodes.
 * Phase 1: Shows in-stock vs not in-stock distinction.
 */
export function RouteLegend() {
    return (
        <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-sm border-2 border-emerald-500 bg-white dark:bg-gray-900" />
                <span className="text-gray-600 dark:text-gray-400">In Stock</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-sm border-2 border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900" />
                <span className="text-gray-600 dark:text-gray-400">Not in Stock</span>
            </div>
        </div>
    )
}
