import { Suspense, use } from 'react'
import type { Metadata } from 'next'

import type { VendorSource } from '@/types'
import { getStockById } from '@/lib/services/view/stock.view'

import { MoleculeFilterBar } from '../_components/server/molecule-filter-bar'
import { MoleculeSearchResults } from '../_components/server/molecule-search-results'
import { StockHeader } from '../_components/server/stock-header'
import { MoleculeGridSkeleton, StockDetailHeaderSkeleton } from '../_components/skeletons'

interface StockDetailPageProps {
    params: Promise<{ stockId: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: StockDetailPageProps): Promise<Metadata> {
    const { stockId } = await params
    const stock = await getStockById(stockId)

    return {
        title: stock?.name || 'Stock Library',
        description: stock?.description || 'Browse molecules in this chemical stock library.',
    }
}

/**
 * Stock detail page showing stock information and molecule search/filter interface.
 * Remains synchronous per the app router manifesto, unwrapping promises with use().
 * Delegates data fetching to async server components wrapped in Suspense boundaries.
 * Stock header, filter bar, and search results load independently via streaming.
 */
export default function StockDetailPage(props: StockDetailPageProps) {
    // ORTHODOXY: Unwrap promises in sync component (Next.js 15 pattern)
    const params = use(props.params)
    const searchParams = use(props.searchParams)

    const { stockId } = params
    const query = typeof searchParams.q === 'string' ? searchParams.q : ''
    const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1

    // Parse filter parameters
    const vendorsParam = typeof searchParams.vendors === 'string' ? searchParams.vendors : undefined
    const vendors = vendorsParam?.split(',').filter(Boolean) as VendorSource[] | undefined

    const minPpgParam = typeof searchParams.minPpg === 'string' ? parseFloat(searchParams.minPpg) : undefined
    const minPpg = isNaN(minPpgParam ?? NaN) ? undefined : minPpgParam

    const maxPpgParam = typeof searchParams.maxPpg === 'string' ? parseFloat(searchParams.maxPpg) : undefined
    const maxPpg = isNaN(maxPpgParam ?? NaN) ? undefined : maxPpgParam

    const buyableOnly = searchParams.buyableOnly === 'true'

    // Create a key that includes all search/filter params for proper Suspense boundaries
    const resultsKey = `results-${page}-${query}-${vendors?.join(',') || ''}-${minPpg || ''}-${maxPpg || ''}-${buyableOnly}`

    return (
        <div className="flex flex-col gap-6">
            {/* Stock header with lazy loading */}
            <Suspense fallback={<StockDetailHeaderSkeleton />}>
                <StockHeader stockId={stockId} />
            </Suspense>

            {/* Filter bar with lazy loading */}
            <Suspense fallback={<div className="bg-muted h-8 w-full animate-pulse rounded-md" />}>
                <MoleculeFilterBar stockId={stockId} />
            </Suspense>

            {/* Search results with lazy loading */}
            <Suspense key={resultsKey} fallback={<MoleculeGridSkeleton />}>
                <MoleculeSearchResults
                    query={query}
                    stockId={stockId}
                    page={page}
                    limit={24}
                    vendors={vendors}
                    minPpg={minPpg}
                    maxPpg={maxPpg}
                    buyableOnly={buyableOnly}
                />
            </Suspense>
        </div>
    )
}
