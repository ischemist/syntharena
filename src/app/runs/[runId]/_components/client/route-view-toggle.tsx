'use client'

import type { RouteViewMode } from '@/types'
import { Button } from '@/components/ui/button'

interface RouteViewToggleProps {
    viewMode: RouteViewMode
    onViewModeChange: (mode: RouteViewMode) => void
    hasGroundTruth: boolean
}

export function RouteViewToggle({ viewMode, onViewModeChange, hasGroundTruth }: RouteViewToggleProps) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm font-medium">View:</span>
            <div className="flex items-center gap-1">
                <Button
                    variant={viewMode === 'prediction-only' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onViewModeChange('prediction-only')}
                >
                    Prediction Only
                </Button>
                <Button
                    variant={viewMode === 'side-by-side' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onViewModeChange('side-by-side')}
                    disabled={!hasGroundTruth}
                >
                    Side-by-Side
                </Button>
                <Button
                    variant={viewMode === 'diff-overlay' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onViewModeChange('diff-overlay')}
                    disabled={!hasGroundTruth}
                >
                    Diff Overlay
                </Button>
            </div>
            {!hasGroundTruth && (
                <span className="text-muted-foreground text-xs italic">(Comparison requires ground truth)</span>
            )}
        </div>
    )
}
