import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import * as stockService from '@/lib/services/stock.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { MoleculeSearchBar } from '../_components/client/molecule-search-bar'
import { MoleculeSearchResults } from '../_components/server/molecule-search-results'
import { MoleculeTableSkeleton } from '../_components/skeletons'

interface StockDetailPageProps {
    params: Promise<{ stockId: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * Stock detail page showing stock information and molecule search interface.
 * Uses streaming with Suspense for search results.
 */
export default async function StockDetailPage({ params, searchParams }: StockDetailPageProps) {
    const { stockId } = await params
    const search = await searchParams

    // Fetch stock details
    let stock
    try {
        stock = await stockService.getStockById(stockId)
    } catch {
        notFound()
    }

    const query = typeof search.q === 'string' ? search.q : ''
    const page = typeof search.page === 'string' ? parseInt(search.page, 10) : 1

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="space-y-4">
                <Link href="/stocks">
                    <Button variant="ghost" size="sm" className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Stocks
                    </Button>
                </Link>

                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight">{stock.name}</h1>
                        <Badge variant="secondary">{stock.itemCount.toLocaleString()} molecules</Badge>
                    </div>
                    {stock.description && <p className="text-muted-foreground">{stock.description}</p>}
                </div>
            </div>

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
