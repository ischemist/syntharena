import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import * as stockService from '@/lib/services/stock.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/**
 * Server component that fetches and displays stock header information.
 * Handles 404 if stock not found. Allows StockDetailPage to remain synchronous.
 */
export async function StockHeader({ stockId }: { stockId: string }) {
    let stock
    try {
        stock = await stockService.getStockById(stockId)
    } catch {
        notFound()
    }

    return (
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
    )
}
