'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface RoutePaginationProps {
    paramName: string
    currentValue: number
    maxValue: number
    label?: string
    /** If true, uses 0-based indexing internally (for acceptableIndex), but displays as 1-based */
    zeroBasedIndex?: boolean
}

/**
 * Unified pagination control for navigating through routes, ranks, or any sequential items.
 * Shows [◀ Prev] Label X of Y [Next ▶] with disabled states at boundaries.
 *
 * Used for:
 * - Model prediction rank navigation (rank1, rank2) - 1-based
 * - Acceptable route navigation (acceptableIndex) - 0-based internally, 1-based display
 *
 * Features:
 * - useTransition for optimistic UI updates
 * - Loading spinner during navigation
 * - Keeps old content visible while new data loads
 */
export function RoutePagination({
    paramName,
    currentValue,
    maxValue,
    label = 'Item',
    zeroBasedIndex = false,
}: RoutePaginationProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const handleValueChange = (newValue: number) => {
        // Validate bounds based on indexing mode
        const minValue = zeroBasedIndex ? 0 : 1
        const maxBound = zeroBasedIndex ? maxValue - 1 : maxValue

        if (newValue < minValue || newValue > maxBound) return

        const params = new URLSearchParams(searchParams.toString())
        params.set(paramName, newValue.toString())

        // Wrap navigation in startTransition for optimistic UI
        startTransition(() => {
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        })
    }

    // Calculate display values (always 1-based for user)
    const displayValue = zeroBasedIndex ? currentValue + 1 : currentValue

    // Calculate boundaries
    const minValue = zeroBasedIndex ? 0 : 1
    const maxBound = zeroBasedIndex ? maxValue - 1 : maxValue

    const isPrevDisabled = currentValue <= minValue || isPending
    const isNextDisabled = currentValue >= maxBound || isPending

    return (
        <div className="flex items-center gap-2">
            {label && <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}:</span>}
            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleValueChange(currentValue - 1)}
                    disabled={isPrevDisabled}
                    className="gap-1"
                >
                    <ChevronLeftIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Prev</span>
                </Button>
                <span className="flex min-w-28 items-center justify-center gap-2 px-3 text-center text-sm text-gray-700 dark:text-gray-300">
                    {isPending ? (
                        <span className="inline-flex items-center gap-1">
                            <Loader2Icon className="h-3 w-3 animate-spin text-gray-500" />
                            Loading...
                        </span>
                    ) : (
                        `${label} ${displayValue} of ${maxValue}`
                    )}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleValueChange(currentValue + 1)}
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
