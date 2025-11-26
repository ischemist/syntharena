'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronsUpDown, X } from 'lucide-react'

import type { BenchmarkTargetWithMolecule } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type TargetSearchProps = {
    onSearch: (query: string) => Promise<BenchmarkTargetWithMolecule[]>
}

export function TargetSearch({ onSearch }: TargetSearchProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState(searchParams.get('search') || '')
    const [results, setResults] = useState<BenchmarkTargetWithMolecule[]>([])
    const [isSearching, setIsSearching] = useState(false)

    // Debounced search effect
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.trim().length >= 2) {
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
            } else {
                setResults([])
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

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
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
                        {!isSearching && query.trim().length >= 2 && results.length === 0 && (
                            <CommandEmpty>No targets found matching &ldquo;{query}&rdquo;</CommandEmpty>
                        )}
                        {!isSearching && results.length > 0 && (
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
                                                <span className="font-mono text-sm font-medium">{target.targetId}</span>
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
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
