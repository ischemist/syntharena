'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Input } from '@/components/ui/input'

interface TargetFiltersProps {
    hasGroundTruth: boolean
    minLength: number
    maxLength: number
}

/**
 * Client component for filtering benchmark targets by convergence and route length.
 * Only shown when benchmark has ground truth data.
 * Updates URL searchParams on filter changes.
 */
export function TargetFilters({ hasGroundTruth, minLength, maxLength }: TargetFiltersProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

    const currentConvergent = searchParams.get('convergent')
    const currentMinLength = searchParams.get('minLength')
    const currentMaxLength = searchParams.get('maxLength')

    // Don't render if no ground truth
    if (!hasGroundTruth) {
        return null
    }

    /**
     * Updates URL search params and resets pagination to page 1
     */
    const updateSearchParams = useCallback(
        (newConvergent: string | null, newMinLength: string | null, newMaxLength: string | null) => {
            const params = new URLSearchParams(searchParams)

            if (newConvergent) {
                params.set('convergent', newConvergent)
            } else {
                params.delete('convergent')
            }

            if (newMinLength) {
                params.set('minLength', newMinLength)
            } else {
                params.delete('minLength')
            }

            if (newMaxLength) {
                params.set('maxLength', newMaxLength)
            } else {
                params.delete('maxLength')
            }

            // Reset to page 1 when filtering
            params.delete('page')

            const query = params.toString()
            const url = query ? `?${query}` : '.'
            router.push(url)
        },
        [router, searchParams]
    )

    /**
     * Handle convergence filter change
     */
    const handleConvergentChange = (convergent: string | null) => {
        updateSearchParams(convergent, currentMinLength, currentMaxLength)
    }

    /**
     * Handle min length change with debouncing
     */
    const handleMinLengthChange = (value: string) => {
        // Clear existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        // Set new timer
        const timer = setTimeout(() => {
            updateSearchParams(currentConvergent, value || null, currentMaxLength)
        }, 300)

        debounceTimerRef.current = timer
    }

    /**
     * Handle max length change with debouncing
     */
    const handleMaxLengthChange = (value: string) => {
        // Clear existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        // Set new timer
        const timer = setTimeout(() => {
            updateSearchParams(currentConvergent, currentMinLength, value || null)
        }, 300)

        debounceTimerRef.current = timer
    }

    /**
     * Clear all filters
     */
    const handleClearFilters = () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        updateSearchParams(null, null, null)
    }

    /**
     * Cleanup timer on unmount
     */
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
        }
    }, [])

    const hasActiveFilters = currentConvergent || currentMinLength || currentMaxLength

    return (
        <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Filters</h3>
                {hasActiveFilters && (
                    <button
                        onClick={handleClearFilters}
                        className="text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
                    >
                        Clear all
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {/* Convergence filter */}
                <div className="space-y-2">
                    <label className="text-muted-foreground text-xs font-medium">Convergence</label>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleConvergentChange(null)}
                            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                                !currentConvergent
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                            }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => handleConvergentChange('true')}
                            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                                currentConvergent === 'true'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                            }`}
                        >
                            Convergent
                        </button>
                        <button
                            onClick={() => handleConvergentChange('false')}
                            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                                currentConvergent === 'false'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                            }`}
                        >
                            Linear
                        </button>
                    </div>
                </div>

                {/* Route length filter */}
                <div className="space-y-2">
                    <label className="text-muted-foreground text-xs font-medium">Route Length</label>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Input
                                type="number"
                                placeholder={`Min (${minLength})`}
                                min={minLength}
                                max={maxLength}
                                defaultValue={currentMinLength || ''}
                                onChange={(e) => handleMinLengthChange(e.target.value)}
                                className="w-full"
                            />
                        </div>
                        <div className="flex-1">
                            <Input
                                type="number"
                                placeholder={`Max (${maxLength})`}
                                min={minLength}
                                max={maxLength}
                                defaultValue={currentMaxLength || ''}
                                onChange={(e) => handleMaxLengthChange(e.target.value)}
                                className="w-full"
                            />
                        </div>
                    </div>
                    <p className="text-muted-foreground text-xs">
                        Range: {minLength} - {maxLength}
                    </p>
                </div>
            </div>
        </div>
    )
}
