'use client'

import { useCallback, useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, Search, X } from 'lucide-react'

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
    hasAcceptableRoutes: boolean
    minLength: number
    maxLength: number
}

/**
 * Compact filter toolbar for benchmark targets.
 * Combines search, search type selector, and filters (when ground truth exists) in a single row.
 * Follows shadcn datatable pattern for compact, professional UI.
 */
export function TargetSearchBar({ hasAcceptableRoutes, minLength, maxLength }: TargetSearchBarProps) {
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

    // Dashed border for inactive filters, solid with shadow for active
    const inactiveFilterClass =
        'border border-dashed border-muted-foreground/30 bg-transparent hover:border-muted-foreground/50 hover:bg-muted/30'
    const activeFilterClass = 'border border-input bg-transparent shadow-xs'

    return (
        <div className="flex items-center gap-2">
            {/* Search input */}
            <div className="relative min-w-[300px] flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
                <Input
                    type="text"
                    placeholder="Search targets by ID, SMILES, or InChI Key..."
                    defaultValue={currentQuery}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    className="h-8 pl-8"
                />
            </div>

            {/* Search type dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className={`h-8 gap-1.5 ${currentSearchType !== 'all' ? activeFilterClass : inactiveFilterClass}`}
                    >
                        {searchTypeLabels[currentSearchType]}
                        <ChevronDown className="h-3 w-3 opacity-50" />
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

            {hasAcceptableRoutes && (
                <>
                    {/* Convergence filter */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className={`h-8 gap-1.5 ${currentConvergent ? activeFilterClass : inactiveFilterClass}`}
                            >
                                {currentConvergent === 'true'
                                    ? 'Convergent'
                                    : currentConvergent === 'false'
                                      ? 'Linear'
                                      : 'Route Type'}
                                <ChevronDown className="h-3 w-3 opacity-50" />
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

                    {/* Steps range filter */}
                    <div className="border-input flex h-8 items-center gap-2 rounded-md border bg-transparent px-3 shadow-xs">
                        <span className="text-muted-foreground text-sm">Steps</span>
                        <Input
                            key={`min-${currentMinLength || 'empty'}`}
                            type="number"
                            placeholder={`${minLength}`}
                            min={minLength}
                            max={maxLength}
                            defaultValue={currentMinLength || ''}
                            onChange={(e) => handleLengthChange('min', e.target.value)}
                            className="h-6 w-16 border-0 bg-transparent px-1 text-center text-sm shadow-none focus-visible:ring-0"
                        />
                        <span className="text-muted-foreground">—</span>
                        <Input
                            key={`max-${currentMaxLength || 'empty'}`}
                            type="number"
                            placeholder={`${maxLength}`}
                            min={minLength}
                            max={maxLength}
                            defaultValue={currentMaxLength || ''}
                            onChange={(e) => handleLengthChange('max', e.target.value)}
                            className="h-6 w-16 border-0 bg-transparent px-1 text-center text-sm shadow-none focus-visible:ring-0"
                        />
                    </div>
                </>
            )}

            {/* Reset button */}
            {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleReset} className="h-8 gap-1 px-2">
                    Reset
                    <X className="h-3.5 w-3.5" />
                </Button>
            )}
        </div>
    )
}
