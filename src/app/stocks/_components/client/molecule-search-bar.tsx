'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, Search, X } from 'lucide-react'

import type { VendorSource } from '@/types'
import { VENDOR_NAMES } from '@/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface MoleculeSearchBarProps {
    availableVendors: VendorSource[]
    totalCount: number
    buyableCount: number
}

/**
 * Compact filter toolbar for stock molecules.
 * Combines search, vendor filter, price range, and buyable-only toggle.
 * Follows shadcn datatable pattern for compact, professional UI.
 */
export function MoleculeSearchBar({ availableVendors, totalCount, buyableCount }: MoleculeSearchBarProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

    const currentQuery = searchParams.get('q') || ''
    const currentVendors = searchParams.get('vendors')?.split(',').filter(Boolean) || []
    const currentMinPpg = searchParams.get('minPpg')
    const currentMaxPpg = searchParams.get('maxPpg')
    const currentBuyableOnly = searchParams.get('buyableOnly') === 'true'

    // Local state for controlled inputs - initialized from URL params
    const [minPpgValue, setMinPpgValue] = useState(currentMinPpg || '')
    const [maxPpgValue, setMaxPpgValue] = useState(currentMaxPpg || '')

    // Reset local state when URL params change externally (e.g., reset button clears URL)
    if ((currentMinPpg || '') !== minPpgValue && minPpgValue !== '' && !currentMinPpg) {
        setMinPpgValue('')
    }
    if ((currentMaxPpg || '') !== maxPpgValue && maxPpgValue !== '' && !currentMaxPpg) {
        setMaxPpgValue('')
    }

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

    const handleVendorToggle = (vendor: VendorSource) => {
        const newVendors = currentVendors.includes(vendor)
            ? currentVendors.filter((v) => v !== vendor)
            : [...currentVendors, vendor]

        updateSearchParams({
            vendors: newVendors.length > 0 ? newVendors.join(',') : null,
        })
    }

    const handlePriceChange = (type: 'min' | 'max', value: string) => {
        // Update local state immediately for responsive UI
        if (type === 'min') {
            setMinPpgValue(value)
        } else {
            setMaxPpgValue(value)
        }

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        const timer = setTimeout(() => {
            updateSearchParams({
                [type === 'min' ? 'minPpg' : 'maxPpg']: value || null,
            })
        }, 300)

        debounceTimerRef.current = timer
    }

    const handleBuyableOnlyChange = (checked: boolean) => {
        updateSearchParams({
            buyableOnly: checked ? 'true' : null,
        })
    }

    const handleReset = () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        router.push(pathname)
    }

    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
        }
    }, [])

    const hasActiveFilters =
        currentQuery || currentVendors.length > 0 || currentMinPpg || currentMaxPpg || currentBuyableOnly

    // Dashed border for inactive filters, solid with shadow for active
    const inactiveFilterClass =
        'border border-dashed border-muted-foreground/30 bg-transparent hover:border-muted-foreground/50 hover:bg-muted/30'
    const activeFilterClass = 'border border-input bg-transparent shadow-xs'

    const hasVendorFilters = availableVendors.length > 0

    return (
        <div className="flex items-center gap-2">
            {/* Search input */}
            <div className="relative min-w-[300px] flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
                <Input
                    type="text"
                    placeholder="Search by SMILES or InChiKey..."
                    defaultValue={currentQuery}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    className="h-8 pl-8"
                />
            </div>

            {/* Vendor filter - only show if there are buyable molecules */}
            {hasVendorFilters && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className={`h-8 gap-1.5 ${currentVendors.length > 0 ? activeFilterClass : inactiveFilterClass}`}
                        >
                            {currentVendors.length > 0 ? `Vendor (${currentVendors.length})` : 'Vendor'}
                            <ChevronDown className="h-3 w-3 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Filter by Vendor</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {availableVendors.map((vendor) => (
                            <DropdownMenuCheckboxItem
                                key={vendor}
                                checked={currentVendors.includes(vendor)}
                                onCheckedChange={() => handleVendorToggle(vendor)}
                            >
                                {VENDOR_NAMES[vendor]}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            {/* Price range filter - only show if there are buyable molecules */}
            {buyableCount > 0 && (
                <div className="border-input flex h-8 items-center gap-2 rounded-md border bg-transparent px-3 shadow-xs">
                    <span className="text-muted-foreground text-sm">$/g</span>
                    <Input
                        type="number"
                        placeholder="Min"
                        min={0}
                        step="0.01"
                        value={minPpgValue}
                        onChange={(e) => handlePriceChange('min', e.target.value)}
                        className="h-6 w-20 border-0 bg-transparent px-1 text-center text-sm shadow-none focus-visible:ring-0"
                    />
                    <span className="text-muted-foreground">—</span>
                    <Input
                        type="number"
                        placeholder="Max"
                        min={0}
                        step="0.01"
                        value={maxPpgValue}
                        onChange={(e) => handlePriceChange('max', e.target.value)}
                        className="h-6 w-20 border-0 bg-transparent px-1 text-center text-sm shadow-none focus-visible:ring-0"
                    />
                </div>
            )}

            {/* Buyable only toggle - only show if there are both buyable and non-buyable */}
            {buyableCount > 0 && buyableCount < totalCount && (
                <div className="border-input flex items-center gap-2 rounded-md border bg-transparent px-3 py-1.5 shadow-xs">
                    <Checkbox
                        id="buyable-only"
                        checked={currentBuyableOnly}
                        onCheckedChange={handleBuyableOnlyChange}
                    />
                    <Label
                        htmlFor="buyable-only"
                        className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Buyable only
                    </Label>
                </div>
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
