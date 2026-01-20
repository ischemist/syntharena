'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

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
 * This component intentionally does NOT use `useTransition`. The desired behavior is for
 * the navigation to immediately trigger a re-render and show the <Suspense> fallback
 * for the new content, providing instant user feedback.
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
    // REMOVED: const [isPending, startTransition] = useTransition()

    const handleValueChange = (newValue: number) => {
        // Validate bounds based on indexing mode
        const minValue = zeroBasedIndex ? 0 : 1
        const maxBound = zeroBasedIndex ? maxValue - 1 : maxValue

        if (newValue < minValue || newValue > maxBound) return

        const params = new URLSearchParams(searchParams.toString())
        params.set(paramName, newValue.toString())

        // REMOVED: startTransition wrapper
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    // Calculate display values (always 1-based for user)
    const displayValue = zeroBasedIndex ? currentValue + 1 : currentValue

    // Calculate boundaries
    const minValue = zeroBasedIndex ? 0 : 1
    const maxBound = zeroBasedIndex ? maxValue - 1 : maxValue

    // REMOVED: isPending from disabled logic
    const isPrevDisabled = currentValue <= minValue
    const isNextDisabled = currentValue >= maxBound

    return (
        <div className="mt-2 flex items-center gap-2">
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
                    {/* REMOVED: isPending ternary */}
                    {`${label} ${displayValue} of ${maxValue}`}
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
