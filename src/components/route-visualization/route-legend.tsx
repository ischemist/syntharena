import type { RouteViewMode } from '@/types'

interface RouteLegendProps {
    viewMode?: RouteViewMode
    isPredictionComparison?: boolean // True for pred-vs-pred, false for GT-vs-pred
}

/**
 * Legend component for route visualization.
 * Shows different items based on the current view mode and comparison type.
 */
export function RouteLegend({ viewMode = 'prediction-only', isPredictionComparison = false }: RouteLegendProps) {
    const isComparisonMode = viewMode === 'side-by-side' || viewMode === 'diff-overlay'

    return (
        <div className="bg-muted/50 flex flex-wrap items-center gap-4 rounded-lg border p-3">
            <span className="text-sm font-medium">Legend:</span>

            {!isComparisonMode && (
                <>
                    {/* Stock availability legend for prediction-only mode */}
                    <div className="flex items-center gap-1.5">
                        <div className="h-4 w-4 rounded border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950" />
                        <span className="text-muted-foreground text-sm">In Stock</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="h-4 w-4 rounded border-2 border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900" />
                        <span className="text-muted-foreground text-sm">Not in Stock</span>
                    </div>
                </>
            )}

            {isComparisonMode && !isPredictionComparison && (
                <>
                    {/* GT vs Prediction comparison legend */}
                    <div className="flex items-center gap-1.5">
                        <div className="h-4 w-4 rounded border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950" />
                        <span className="text-muted-foreground text-sm">Match</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="h-4 w-4 rounded border-2 border-amber-500 bg-amber-50 dark:bg-amber-950" />
                        <span className="text-muted-foreground text-sm">Extension</span>
                    </div>
                    {viewMode === 'diff-overlay' && (
                        <div className="flex items-center gap-1.5">
                            <div className="h-4 w-4 rounded border-2 border-dashed border-gray-400 bg-gray-100 opacity-60 dark:bg-gray-800" />
                            <span className="text-muted-foreground text-sm">Missing (Ghost)</span>
                        </div>
                    )}
                </>
            )}

            {isComparisonMode && isPredictionComparison && (
                <>
                    {/* Prediction vs Prediction comparison legend */}
                    <div className="flex items-center gap-1.5">
                        <div className="h-4 w-4 rounded border-2 border-teal-500 bg-teal-50 dark:bg-teal-950" />
                        <span className="text-muted-foreground text-sm">Both Routes</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="h-4 w-4 rounded border-2 border-sky-500 bg-sky-50 dark:bg-sky-950" />
                        <span className="text-muted-foreground text-sm">Model 1 Only</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="h-4 w-4 rounded border-2 border-violet-500 bg-violet-50 dark:bg-violet-950" />
                        <span className="text-muted-foreground text-sm">Model 2 Only</span>
                    </div>
                </>
            )}
        </div>
    )
}
