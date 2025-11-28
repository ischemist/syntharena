import { AlertCircle } from 'lucide-react'

import * as stockService from '@/lib/services/stock.service'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import { MoleculeCard } from '../client/molecule-card'
import { MoleculePagination } from '../client/molecule-pagination'

interface MoleculeSearchResultsProps {
    query?: string
    stockId: string
    page?: number
    limit?: number
}

/**
 * Server component that fetches and displays molecule search results.
 * Shows all molecules by default, optionally filtered by search query.
 * Shows molecules in a responsive grid layout with pagination.
 * Uses optimized search function to fetch molecules with stocks in single query.
 */
export async function MoleculeSearchResults({ query = '', stockId, page = 1, limit = 50 }: MoleculeSearchResultsProps) {
    const offset = (page - 1) * limit
    // Use optimized function that fetches molecules with stocks in a single query
    const isSearching = query.trim().length > 0

    const result = isSearching
        ? await stockService.searchMolecules(query, stockId, limit, offset)
        : await stockService.getStockMolecules(stockId, limit, offset)

    const moleculesWithStocks = result.molecules

    if (result.molecules.length === 0) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No results found</AlertTitle>
                <AlertDescription>
                    {query ? (
                        <>No molecules found matching &quot;{query}&quot;. Try a different search term.</>
                    ) : (
                        <>This stock contains no molecules.</>
                    )}
                </AlertDescription>
            </Alert>
        )
    }

    const isFiltering = query && query.trim().length > 0
    const totalPages = Math.ceil(result.total / limit)

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <p className="text-muted-foreground text-sm">
                    {isFiltering ? (
                        <>
                            Found {result.total.toLocaleString()} {result.total === 1 ? 'molecule' : 'molecules'}{' '}
                            matching &quot;{query}&quot;
                        </>
                    ) : (
                        <>
                            Total: {result.total.toLocaleString()} {result.total === 1 ? 'molecule' : 'molecules'}
                        </>
                    )}
                </p>
            </div>

            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-10">
                {moleculesWithStocks.map((molecule, index) => (
                    <MoleculeCard key={molecule.id} molecule={molecule} index={index} />
                ))}
            </div>

            <MoleculePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={result.total}
                itemsPerPage={limit}
            />
        </div>
    )
}
