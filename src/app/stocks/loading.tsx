import { StockListSkeleton } from './_components/skeletons'

/**
 * Loading shell for stocks list page.
 * Provides instant full-page layout before data loads.
 * Uses static skeleton to prevent layout shift.
 */
export default function StocksLoading() {
    return (
        <div className="space-y-6">
            {/* Header section with static content */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Stock Libraries</h1>
                <p className="text-muted-foreground">Browse available chemical stock libraries</p>
            </div>

            {/* Skeleton for stock cards */}
            <StockListSkeleton />
        </div>
    )
}
