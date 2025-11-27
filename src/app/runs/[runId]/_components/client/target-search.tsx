'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, ChevronsUpDown, X } from 'lucide-react'

import type { BenchmarkTargetWithMolecule } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type NavigationData = {
    totalTargets: number
    currentIndex?: number
    previousTargetId?: string
    nextTargetId?: string
}

type TargetSearchProps = {
    onSearch: (query: string) => Promise<BenchmarkTargetWithMolecule[]>
    navigation: NavigationData
}

export function TargetSearch({ onSearch, navigation }: TargetSearchProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState(searchParams.get('search') || '')
    const [results, setResults] = useState<BenchmarkTargetWithMolecule[]>([])
    const [isSearching, setIsSearching] = useState(false)

    // Load initial results when popover opens
    useEffect(() => {
        if (open && results.length === 0 && !query) {
            setIsSearching(true)
            onSearch('')
                .then(setResults)
                .catch((error) => {
                    console.error('Failed to load initial targets:', error)
                    setResults([])
                })
                .finally(() => setIsSearching(false))
        }
    }, [open, onSearch, query, results.length])

    // Debounced search effect
    useEffect(() => {
        const timer = setTimeout(async () => {
            setIsSearching(true)
            try {
                const searchResults = await onSearch(query)
                setResults(searchResults)
            } catch (error) {
                console.error('Search failed:', error)
                setResults([])
            } finally {
                setIsSearching(false)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [query, onSearch])

    const handleInputChange = (value: string) => {
        setQuery(value)
        // Update URL with search query
        const params = new URLSearchParams(searchParams.toString())
        if (value.trim()) {
            params.set('search', value)
        } else {
            params.delete('search')
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const handleSelectTarget = (targetId: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('target', targetId)
        params.set('rank', '1') // Default to first prediction
        // Preserve view mode if it exists
        const currentView = searchParams.get('view')
        if (currentView) {
            params.set('view', currentView)
        }
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
        setOpen(false) // Close the popover
    }

    const handleClear = () => {
        setQuery('')
        setResults([])
        const params = new URLSearchParams(searchParams.toString())
        params.delete('search')
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const handleNavigate = (targetId: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('target', targetId)
        params.set('rank', '1') // Reset to first prediction
        // Preserve view mode if it exists
        const currentView = searchParams.get('view')
        if (currentView) {
            params.set('view', currentView)
        }
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    return (
        <div className="flex gap-2">
            {/* Navigation Controls */}
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigation.previousTargetId && handleNavigate(navigation.previousTargetId)}
                    disabled={!navigation.previousTargetId}
                    title="Previous target"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                {navigation.currentIndex !== undefined && (
                    <div className="text-muted-foreground text-sm whitespace-nowrap">
                        Target {navigation.currentIndex + 1} of {navigation.totalTargets}
                    </div>
                )}
                {navigation.currentIndex === undefined && navigation.totalTargets > 0 && (
                    <div className="text-muted-foreground text-sm whitespace-nowrap">
                        {navigation.totalTargets} targets
                    </div>
                )}
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigation.nextTargetId && handleNavigate(navigation.nextTargetId)}
                    disabled={!navigation.nextTargetId}
                    title="Next target"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Search Popover */}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={open} className="flex-1 justify-between">
                        <span className="text-muted-foreground truncate">
                            {query || 'Search by target ID or SMILES...'}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={false}>
                        <div className="relative">
                            <CommandInput
                                placeholder="Search by target ID or SMILES..."
                                value={query}
                                onValueChange={handleInputChange}
                            />
                            {query && (
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={handleClear}
                                    className="absolute top-1/2 right-1 -translate-y-1/2"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                        <CommandList>
                            {isSearching && (
                                <div className="py-6 text-center text-sm">
                                    <p className="text-muted-foreground">Searching...</p>
                                </div>
                            )}
                            {!isSearching && query.trim() && results.length === 0 && (
                                <CommandEmpty>No targets found matching &ldquo;{query}&rdquo;</CommandEmpty>
                            )}
                            {!isSearching && !query.trim() && results.length === 0 && (
                                <div className="py-6 text-center text-sm">
                                    <p className="text-muted-foreground">No targets available</p>
                                </div>
                            )}
                            {!isSearching && results.length > 0 && (
                                <>
                                    <CommandGroup>
                                        {results.map((target) => (
                                            <CommandItem
                                                key={target.id}
                                                value={target.id}
                                                onSelect={() => handleSelectTarget(target.id)}
                                                className="flex-col items-start gap-1 py-3"
                                            >
                                                <div className="flex w-full items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-sm font-medium">
                                                            {target.targetId}
                                                        </span>
                                                        {target.routeCount && target.routeCount > 0 ? (
                                                            <Badge variant="secondary" className="text-xs">
                                                                {target.routeCount} routes
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-xs">
                                                                No routes
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {target.routeLength && (
                                                        <div className="text-muted-foreground text-xs">
                                                            Length: {target.routeLength}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-muted-foreground w-full truncate font-mono text-xs">
                                                    {target.molecule.smiles}
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                    {results.length === 20 && !query.trim() && navigation.totalTargets > 20 && (
                                        <div className="text-muted-foreground border-t px-3 py-2 text-center text-xs">
                                            Showing first 20 of {navigation.totalTargets} targets. Type to search.
                                        </div>
                                    )}
                                    {results.length === 20 && query.trim() && (
                                        <div className="text-muted-foreground border-t px-3 py-2 text-center text-xs">
                                            Showing first 20 matches. Refine search to see more.
                                        </div>
                                    )}
                                </>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    )
}
