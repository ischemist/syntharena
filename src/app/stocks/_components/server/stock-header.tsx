import { notFound } from 'next/navigation'

import * as stockView from '@/lib/services/view/stock.view'
import { Badge } from '@/components/ui/badge'

/**
 * Server component that fetches and displays stock header information.
 * Handles 404 if stock not found. Allows StockDetailPage to remain synchronous.
 */
export async function StockHeader({ stockId }: { stockId: string }) {
    let stock
    try {
        stock = await stockView.getStockById(stockId)
    } catch {
        notFound()
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{stock.name}</h1>
                <Badge variant="secondary">{stock.itemCount.toLocaleString()} molecules</Badge>
            </div>
            {stock.description && <p className="text-muted-foreground">{stock.description}</p>}
        </div>
    )
}
