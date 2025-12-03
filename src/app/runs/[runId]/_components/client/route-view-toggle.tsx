'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import type { RouteViewMode } from '@/types'
import { Button } from '@/components/ui/button'

interface RouteViewToggleProps {
    viewMode: RouteViewMode
    hasAcceptableRoute: boolean
}

export function RouteViewToggle({ viewMode, hasAcceptableRoute }: RouteViewToggleProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleViewModeChange = (mode: RouteViewMode) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('view', mode)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    return (
        <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm font-medium">View:</span>
            <div className="flex items-center gap-1">
                <Button
                    variant={viewMode === 'prediction-only' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleViewModeChange('prediction-only')}
                >
                    Prediction Only
                </Button>
                <Button
                    variant={viewMode === 'side-by-side' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleViewModeChange('side-by-side')}
                    disabled={!hasAcceptableRoute}
                >
                    Side-by-Side
                </Button>
                <Button
                    variant={viewMode === 'diff-overlay' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleViewModeChange('diff-overlay')}
                    disabled={!hasAcceptableRoute}
                >
                    Diff Overlay
                </Button>
            </div>
            {!hasAcceptableRoute && (
                <span className="text-muted-foreground text-xs italic">(Comparison requires acceptable routes)</span>
            )}
        </div>
    )
}
