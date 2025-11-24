import { StockDetailSkeleton } from '../_components/skeletons'

/**
 * Loading shell for stock detail page.
 * Provides instant full-page layout before data loads.
 * Uses static skeleton to prevent layout shift.
 */
export default function StockDetailLoading() {
    return (
        <div className="space-y-6">
            <StockDetailSkeleton />
        </div>
    )
}
