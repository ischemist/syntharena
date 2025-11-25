'use client'

import { useCallback, useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'

type SearchType = 'smiles' | 'inchikey' | 'targetId' | 'all'

interface TargetSearchBarProps {
    hasGroundTruth: boolean
    minLength: number
    maxLength: number
}

/**
 * Compact filter toolbar for benchmark targets.
 * Combines search, search type selector, and filters (when ground truth exists) in a single row.
 * Follows shadcn datatable pattern for compact, professional UI.
 */
export function TargetSearchBar({ hasGroundTruth, minLength, maxLength }: TargetSearchBarProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

    const currentQuery = searchParams.get('q') || ''
    const currentSearchType = (searchParams.get('searchType') || 'all') as SearchType
    const currentConvergent = searchParams.get('convergent')
    const currentMinLength = searchParams.get('minLength')
    const currentMaxLength = searchParams.get('maxLength')

    /**
     * Updates URL search params and resets pagination to page 1
     */
    const updateSearchParams = useCallback(
        (updates: Partial<Record<string, string | null>>) => {
            const params = new URLSearchParams(searchParams)

            // Apply updates
            Object.entries(updates).forEach(([key, value]) => {
                if (value) {
                    params.set(key, value)
                } else {
                    params.delete(key)
                }
            })

            // Reset to page 1 when filtering
            params.delete('page')

            const query = params.toString()
            const url = query ? `${pathname}?${query}` : pathname
            router.push(url)
        },
        [router, pathname, searchParams]
    )

    /**
     * Handle search input change with debouncing
     */
    const handleQueryChange = (newQuery: string) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        const timer = setTimeout(() => {
            updateSearchParams({
                q: newQuery.trim() || null,
            })
        }, 300)

        debounceTimerRef.current = timer
    }

    /**
     * Handle search type change
     */
    const handleSearchTypeChange = (newSearchType: string) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        updateSearchParams({
            searchType: newSearchType === 'all' ? null : newSearchType,
        })
    }

    /**
     * Handle convergence filter
     */
    const handleConvergentChange = (value: string) => {
        updateSearchParams({
            convergent: value === 'all' ? null : value,
        })
    }

    /**
     * Handle length filters with debouncing
     */
    const handleLengthChange = (type: 'min' | 'max', value: string) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        const timer = setTimeout(() => {
            updateSearchParams({
                [type === 'min' ? 'minLength' : 'maxLength']: value || null,
            })
        }, 300)

        debounceTimerRef.current = timer
    }

    /**
     * Reset all filters
     */
    const handleReset = () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        router.push(pathname)
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

    const searchTypeLabels: Record<SearchType, string> = {
        all: 'All Fields',
        smiles: 'SMILES',
        inchikey: 'InChiKey',
        targetId: 'Target ID',
    }

    const hasActiveFilters =
        currentQuery || currentConvergent || currentMinLength || currentMaxLength || currentSearchType !== 'all'

    return (
        <div className="flex items-center gap-2">
            {/* Search input */}
            <div className="relative max-w-sm flex-1">
                <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
                <Input
                    type="text"
                    placeholder="Search targets..."
                    defaultValue={currentQuery}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    className="pl-8"
                />
            </div>

            {/* Search type dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                        {searchTypeLabels[currentSearchType]}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    <DropdownMenuRadioGroup value={currentSearchType} onValueChange={handleSearchTypeChange}>
                        <DropdownMenuRadioItem value="all">All Fields</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="smiles">SMILES</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="inchikey">InChiKey</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="targetId">Target ID</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Filters (only show when ground truth exists) */}
            {hasGroundTruth && (
                <>
                    {/* Convergence filter */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9">
                                {currentConvergent === 'true'
                                    ? 'Convergent'
                                    : currentConvergent === 'false'
                                      ? 'Linear'
                                      : 'All Routes'}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuRadioGroup
                                value={currentConvergent || 'all'}
                                onValueChange={handleConvergentChange}
                            >
                                <DropdownMenuRadioItem value="all">All Routes</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="true">Convergent</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="false">Linear</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Length filters */}
                    <Input
                        type="number"
                        placeholder={`Min (${minLength})`}
                        min={minLength}
                        max={maxLength}
                        defaultValue={currentMinLength || ''}
                        onChange={(e) => handleLengthChange('min', e.target.value)}
                        className="h-9 w-24"
                    />
                    <Input
                        type="number"
                        placeholder={`Max (${maxLength})`}
                        min={minLength}
                        max={maxLength}
                        defaultValue={currentMaxLength || ''}
                        onChange={(e) => handleLengthChange('max', e.target.value)}
                        className="h-9 w-24"
                    />
                </>
            )}

            {/* Reset button */}
            {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleReset} className="h-9 px-2">
                    <X className="h-4 w-4" />
                </Button>
            )}
        </div>
    )
}
