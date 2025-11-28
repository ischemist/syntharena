'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface RankPaginationProps {
    paramName: 'rank1' | 'rank2'
    currentRank: number
    maxRank: number
    label?: string
}

/**
 * Pagination-style control for navigating through route ranks.
 * Shows [◀ Prev] Rank X of Y [Next ▶] with disabled states at boundaries.
 *
 * Phase 7 optimization:
 * - Uses useTransition for optimistic UI updates
 * - Shows loading spinner instead of unmounting entire UI
 * - Keeps old content visible while new data loads
 */
export function RankPagination({ paramName, currentRank, maxRank, label }: RankPaginationProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const handleRankChange = (newRank: number) => {
        if (newRank < 1 || newRank > maxRank) return

        const params = new URLSearchParams(searchParams.toString())
        params.set(paramName, newRank.toString())

        // Phase 7: Wrap navigation in startTransition for optimistic UI
        startTransition(() => {
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        })
    }

    const isPrevDisabled = currentRank <= 1 || isPending
    const isNextDisabled = currentRank >= maxRank || isPending

    return (
        <div className="flex items-center gap-2">
            {label && <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}:</span>}
            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRankChange(currentRank - 1)}
                    disabled={isPrevDisabled}
                    className="gap-1"
                >
                    <ChevronLeftIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Prev</span>
                </Button>
                <span className="flex items-center gap-2 px-3 text-sm text-gray-700 dark:text-gray-300">
                    Rank {currentRank} of {maxRank}
                    {isPending && <Loader2Icon className="h-3 w-3 animate-spin text-gray-500" />}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRankChange(currentRank + 1)}
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
