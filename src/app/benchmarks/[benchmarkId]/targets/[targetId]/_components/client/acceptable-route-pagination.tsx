'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface AcceptableRoutePaginationProps {
    currentIndex: number // 0-based index
    totalRoutes: number
    label?: string
}

/**
 * Pagination-style control for navigating through acceptable routes.
 * Shows [◀ Prev] Route X of Y [Next ▶] with disabled states at boundaries.
 *
 * Mirrors RankPagination component but for acceptable routes.
 * Uses 0-based indexing internally (matching DB routeIndex), 1-based for display.
 * URL param: acceptableIndex (0-based)
 */
export function AcceptableRoutePagination({ currentIndex, totalRoutes, label }: AcceptableRoutePaginationProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const handleIndexChange = (newIndex: number) => {
        if (newIndex < 0 || newIndex >= totalRoutes) return

        const params = new URLSearchParams(searchParams.toString())
        params.set('acceptableIndex', newIndex.toString())

        // Wrap navigation in startTransition for optimistic UI
        startTransition(() => {
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        })
    }

    const isPrevDisabled = currentIndex <= 0 || isPending
    const isNextDisabled = currentIndex >= totalRoutes - 1 || isPending

    // Display as 1-based (Route 1 of 4) but store as 0-based
    const displayNumber = currentIndex + 1

    return (
        <div className="flex items-center gap-2">
            {label && <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}:</span>}
            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleIndexChange(currentIndex - 1)}
                    disabled={isPrevDisabled}
                    className="gap-1"
                >
                    <ChevronLeftIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Prev</span>
                </Button>
                <span className="flex items-center gap-2 px-3 text-sm text-gray-700 dark:text-gray-300">
                    Route {displayNumber} of {totalRoutes}
                    {currentIndex === 0 && <span className="text-xs text-gray-500 dark:text-gray-400">(Primary)</span>}
                    {isPending && <Loader2Icon className="h-3 w-3 animate-spin text-gray-500" />}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleIndexChange(currentIndex + 1)}
                    disabled={isNextDisabled}
                    className="gap-1"
                >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRightIcon className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}
