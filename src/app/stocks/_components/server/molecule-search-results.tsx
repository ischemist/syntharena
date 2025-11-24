import { AlertCircle } from 'lucide-react'

import * as stockService from '@/lib/services/stock.service'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

import { MoleculeCard } from '../client/molecule-card'

interface MoleculeSearchResultsProps {
    query: string
    stockId: string
    limit?: number
}

/**
 * Server component that fetches and displays molecule search results.
 * Shows molecules in a responsive grid layout.
 */
export async function MoleculeSearchResults({ query, stockId, limit = 50 }: MoleculeSearchResultsProps) {
    if (!query || query.trim().length === 0) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No search query</AlertTitle>
                <AlertDescription>Enter a SMILES or InChiKey to search for molecules.</AlertDescription>
            </Alert>
        )
    }

    const result = await stockService.searchStockMolecules(query, stockId, limit)

    if (result.molecules.length === 0) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No results found</AlertTitle>
                <AlertDescription>
                    No molecules found matching &quot;{query}&quot;. Try a different search term.
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <p className="text-muted-foreground text-sm">
                    Found {result.total.toLocaleString()} {result.total === 1 ? 'molecule' : 'molecules'}
                </p>
                {result.hasMore && (
                    <Badge variant="secondary" className="text-xs">
                        Showing first {limit}
                    </Badge>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {result.molecules.map((molecule) => (
                    <MoleculeCard key={molecule.id} molecule={molecule} />
                ))}
            </div>
        </div>
    )
}
