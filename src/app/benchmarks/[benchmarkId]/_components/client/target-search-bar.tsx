'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Input } from '@/components/ui/input'

type SearchType = 'smiles' | 'inchikey' | 'targetId' | 'all'

/**
 * Client component for searching benchmark targets by SMILES, InChiKey, or Target ID.
 * Updates URL searchParams on input change (debounced).
 * Shares state via URL for full shareability and refreshability.
 */
export function TargetSearchBar() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

    const currentQuery = searchParams.get('q') || ''
    const currentSearchType = (searchParams.get('searchType') || 'all') as SearchType

    /**
     * Updates URL search params and resets pagination to page 1
     */
    const updateSearchParams = useCallback(
        (newQuery: string, newSearchType: SearchType) => {
            const params = new URLSearchParams(searchParams)

            if (newQuery.trim()) {
                params.set('q', newQuery.trim())
            } else {
                params.delete('q')
            }

            if (newSearchType !== 'all') {
                params.set('searchType', newSearchType)
            } else {
                params.delete('searchType')
            }

            // Reset to page 1 when searching
            params.delete('page')

            const query = params.toString()
            const url = query ? `?${query}` : '.'
            router.push(url)
        },
        [router, searchParams]
    )

    /**
     * Handle search input change with debouncing
     */
    const handleQueryChange = (newQuery: string) => {
        // Clear existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        // Set new timer
        const timer = setTimeout(() => {
            updateSearchParams(newQuery, currentSearchType)
        }, 300)

        debounceTimerRef.current = timer
    }

    /**
     * Handle search type change
     */
    const handleSearchTypeChange = (newSearchType: SearchType) => {
        // Clear debounce timer if one is pending
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        updateSearchParams(currentQuery, newSearchType)
    }

    /**
     * Clear search
     */
    const handleClear = () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        updateSearchParams('', 'all')
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

    const searchTypeOptions: { value: SearchType; label: string }[] = [
        { value: 'all', label: 'All Fields' },
        { value: 'smiles', label: 'SMILES' },
        { value: 'inchikey', label: 'InChiKey' },
        { value: 'targetId', label: 'Target ID' },
    ]

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                    <div className="flex-1">
                        <Input
                            type="text"
                            placeholder="Search by SMILES, InChiKey, or Target ID..."
                            defaultValue={currentQuery}
                            onChange={(e) => handleQueryChange(e.target.value)}
                            className="w-full"
                        />
                    </div>
                    {currentQuery && (
                        <button
                            onClick={handleClear}
                            className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-2 text-sm font-medium transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {/* Search type filter buttons */}
                <div className="flex gap-2">
                    {searchTypeOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => handleSearchTypeChange(option.value)}
                            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                                currentSearchType === option.value
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
