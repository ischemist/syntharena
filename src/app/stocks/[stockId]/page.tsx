import { Suspense, use } from 'react'
import type { Metadata } from 'next'

import { getStockById } from '@/lib/services/stock.service'

import { MoleculeSearchBar } from '../_components/client/molecule-search-bar'
import { MoleculeSearchResults } from '../_components/server/molecule-search-results'
import { StockHeader } from '../_components/server/stock-header'
import { MoleculeTableSkeleton, StockDetailHeaderSkeleton } from '../_components/skeletons'

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
 * Stock detail page showing stock information and molecule search interface.
 * Remains synchronous per the app router manifesto, unwrapping promises with use().
 * Delegates data fetching to async server components wrapped in Suspense boundaries.
 * Stock header and search results load independently via streaming.
 */
export default function StockDetailPage(props: StockDetailPageProps) {
    // ORTHODOXY: Unwrap promises in sync component (Next.js 15 pattern)
    const params = use(props.params)
    const searchParams = use(props.searchParams)

    const { stockId } = params
    const query = typeof searchParams.q === 'string' ? searchParams.q : ''
    const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1

    return (
        <div className="space-y-6">
            {/* Stock header with lazy loading */}
            <Suspense fallback={<StockDetailHeaderSkeleton />}>
                <StockHeader stockId={stockId} />
            </Suspense>

            {/* Search Interface */}
            <div className="space-y-4">
                <MoleculeSearchBar />

                <Suspense key={`${query}-${page}`} fallback={<MoleculeTableSkeleton />}>
                    <MoleculeSearchResults query={query} stockId={stockId} page={page} limit={50} />
                </Suspense>
            </div>
        </div>
    )
}
