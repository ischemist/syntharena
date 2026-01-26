'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'

interface DisplayModeToggleProps {
    currentDisplayMode: 'side-by-side' | 'diff-overlay'
}

export function DisplayModeToggle({ currentDisplayMode }: DisplayModeToggleProps) {
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const buildHref = (mode: 'side-by-side' | 'diff-overlay') => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('display', mode) // standardizing on 'display'
        return `${pathname}?${params.toString()}`
    }

    return (
        <div className="flex gap-1">
            <Button variant={currentDisplayMode === 'side-by-side' ? 'default' : 'outline'} size="sm" asChild>
                <Link href={buildHref('side-by-side')} replace scroll={false}>
                    Side-by-Side
                </Link>
            </Button>
            <Button variant={currentDisplayMode === 'diff-overlay' ? 'default' : 'outline'} size="sm" asChild>
                <Link href={buildHref('diff-overlay')} replace scroll={false}>
                    Diff Overlay
                </Link>
            </Button>
        </div>
    )
}
