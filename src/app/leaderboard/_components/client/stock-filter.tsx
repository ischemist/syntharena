'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import type { StockListItem } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type StockFilterProps = {
    stocks: StockListItem[]
    selectedStockId?: string
}

/**
 * Client component for filtering leaderboard by stock.
 * Uses URL searchParams for canonical state.
 *
 * Following App Router Manifesto:
 * - Client component for interactive UI (onClick)
 * - Updates URL via router.push (canonical state in URL)
 * - Server re-renders with new stock filter
 */
export function StockFilter({ stocks, selectedStockId }: StockFilterProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleStockChange = (stockId?: string) => {
        const params = new URLSearchParams(searchParams.toString())

        if (stockId) {
            params.set('stock', stockId)
        } else {
            params.delete('stock')
        }

        router.push(`${pathname}?${params.toString()}`)
    }

    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Filter by Stock:</span>
                    <Button
                        variant={!selectedStockId ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleStockChange(undefined)}
                    >
                        All
                    </Button>
                    {stocks.map((stock) => (
                        <Button
                            key={stock.id}
                            variant={selectedStockId === stock.id ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleStockChange(stock.id)}
                        >
                            {stock.name}
                        </Button>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
