'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

import type { ComparisonLayoutMode } from '@/types'
import { Button } from '@/components/ui/button'

interface LayoutModeToggleProps {
    currentLayout: ComparisonLayoutMode
}

export function LayoutModeToggle({ currentLayout }: LayoutModeToggleProps) {
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const buildHref = (mode: ComparisonLayoutMode) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('layout', mode)
        return `${pathname}?${params.toString()}`
    }

    return (
        <div className="flex gap-1">
            <Button variant={currentLayout === 'side-by-side' ? 'default' : 'outline'} size="sm" asChild>
                <Link href={buildHref('side-by-side')} replace scroll={false}>
                    Side-by-Side
                </Link>
            </Button>
            <Button variant={currentLayout === 'diff-overlay' ? 'default' : 'outline'} size="sm" asChild>
                <Link href={buildHref('diff-overlay')} replace scroll={false}>
                    Diff Overlay
                </Link>
            </Button>
        </div>
    )
}
