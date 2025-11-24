'use client'

import { useCallback, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Client component for molecule search input.
 * Updates URL search params to trigger server-side search re-render.
 * The URL is the single source of truth for search results (Rule #3).
 * Local state tracks input value during typing (ephemeral UI state).
 */
export function MoleculeSearchBar() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    // Read query from URL (the canonical state for rendered results)
    const urlQuery = searchParams.get('q') || ''

    // Local state for input value during typing (ephemeral, non-canonical UI state)
    // Initialized from URL but updated as user types
    const [inputValue, setInputValue] = useState(urlQuery)

    const handleSearch = useCallback(
        (searchQuery: string) => {
            const params = new URLSearchParams(searchParams)

            if (searchQuery) {
                params.set('q', searchQuery)
            } else {
                params.delete('q')
            }

            // Reset to first page on new search
            params.delete('page')

            startTransition(() => {
                router.replace(`${pathname}?${params.toString()}`)
            })
        },
        [pathname, router, searchParams]
    )

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        handleSearch(inputValue)
    }

    const handleClear = () => {
        setInputValue('')
        handleSearch('')
    }

    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                    type="text"
                    placeholder="Filter by SMILES or InChiKey..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="pr-10 pl-10"
                    disabled={isPending}
                />
                {inputValue && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        className="absolute top-1/2 right-2 h-6 w-6 -translate-y-1/2 p-0"
                        disabled={isPending}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>
            <Button type="submit" disabled={isPending || !inputValue.trim()}>
                {isPending ? 'Searching...' : 'Search'}
            </Button>
        </form>
    )
}
