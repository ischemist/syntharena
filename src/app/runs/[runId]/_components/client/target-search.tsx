'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

import type { BenchmarkTargetWithMolecule } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type TargetSearchProps = {
    onSearch: (query: string) => Promise<BenchmarkTargetWithMolecule[]>
}

export function TargetSearch({ onSearch }: TargetSearchProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [query, setQuery] = useState(searchParams.get('search') || '')
    const [results, setResults] = useState<BenchmarkTargetWithMolecule[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [showResults, setShowResults] = useState(false)

    // Debounced search effect
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.trim().length >= 2) {
                setIsSearching(true)
                try {
                    const searchResults = await onSearch(query)
                    setResults(searchResults)
                    setShowResults(true)
                } catch (error) {
                    console.error('Search failed:', error)
                    setResults([])
                } finally {
                    setIsSearching(false)
                }
            } else {
                setResults([])
                setShowResults(false)
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
        router.replace(`${pathname}?${params.toString()}`)
    }

    const handleSelectTarget = (targetId: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('target', targetId)
        params.set('rank', '1') // Default to first prediction
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
        setShowResults(false)
    }

    const handleClear = () => {
        setQuery('')
        setResults([])
        setShowResults(false)
        const params = new URLSearchParams(searchParams.toString())
        params.delete('search')
        router.replace(`${pathname}?${params.toString()}`)
    }

    return (
        <div className="relative">
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                            <Input
                                type="text"
                                placeholder="Search by target ID or SMILES..."
                                value={query}
                                onChange={(e) => handleInputChange(e.target.value)}
                                className="pr-9 pl-9"
                            />
                            {query && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleClear}
                                    className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 p-0"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                    {isSearching && <p className="text-muted-foreground mt-2 text-sm">Searching...</p>}
                </CardContent>
            </Card>

            {/* Search results dropdown */}
            {showResults && results.length > 0 && (
                <Card className="absolute top-full right-0 left-0 z-50 mt-2 max-h-96 overflow-y-auto">
                    <CardContent className="p-2">
                        <div className="space-y-1">
                            {results.map((target) => (
                                <button
                                    key={target.id}
                                    onClick={() => handleSelectTarget(target.id)}
                                    className="hover:bg-muted w-full rounded-md p-3 text-left transition-colors"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0 flex-1">
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
                                            <div className="text-muted-foreground mt-1 truncate font-mono text-xs">
                                                {target.molecule.smiles}
                                            </div>
                                        </div>
                                        {target.routeLength && (
                                            <div className="text-muted-foreground text-xs">
                                                Length: {target.routeLength}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {showResults && results.length === 0 && !isSearching && query.trim().length >= 2 && (
                <Card className="absolute top-full right-0 left-0 z-50 mt-2">
                    <CardContent className="p-4">
                        <p className="text-muted-foreground text-sm">No targets found matching &ldquo;{query}&rdquo;</p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
