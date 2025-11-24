'use client'

import { useCallback, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Client component for molecule search input.
 * Updates URL search params to trigger server-side search re-render.
 */
export function MoleculeSearchBar() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const [query, setQuery] = useState(searchParams.get('q') || '')

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
        handleSearch(query)
    }

    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                    type="text"
                    placeholder="Filter by SMILES or InChiKey..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-10"
                    disabled={isPending}
                />
            </div>
            <Button type="submit" disabled={isPending || !query.trim()}>
                {isPending ? 'Searching...' : 'Search'}
            </Button>
        </form>
    )
}
