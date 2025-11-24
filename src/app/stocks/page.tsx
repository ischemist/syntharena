import { Suspense } from 'react'

import { StockList } from './_components/server/stock-list'
import { StockListSkeleton } from './_components/skeletons'

/**
 * Main stocks page showing all available stock libraries.
 * Uses streaming with Suspense for instant layout render.
 */
export default function StocksPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Stock Libraries</h1>
                <p className="text-muted-foreground">Browse available chemical stock libraries</p>
            </div>

            <Suspense fallback={<StockListSkeleton />}>
                <StockList />
            </Suspense>
        </div>
    )
}
