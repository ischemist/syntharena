'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import type { RouteLayoutMode } from '@/types'
import { Button } from '@/components/ui/button'

interface RouteViewToggleProps {
    layout: RouteLayoutMode
    hasAcceptableRoute: boolean
}

export function RouteViewToggle({ layout, hasAcceptableRoute }: RouteViewToggleProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleLayoutChange = (mode: RouteLayoutMode) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('layout', mode)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    return (
        <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm font-medium">View:</span>
            <div className="flex items-center gap-1">
                <Button
                    variant={layout === 'prediction-only' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleLayoutChange('prediction-only')}
                >
                    Prediction Only
                </Button>
                <Button
                    variant={layout === 'side-by-side' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleLayoutChange('side-by-side')}
                    disabled={!hasAcceptableRoute}
                >
                    Side-by-Side
                </Button>
                <Button
                    variant={layout === 'diff-overlay' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleLayoutChange('diff-overlay')}
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
