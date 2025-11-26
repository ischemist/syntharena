'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import type { StockListItem } from '@/types'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface StockSelectorProps {
    stocks: StockListItem[]
}

export function StockSelector({ stocks }: StockSelectorProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const currentStock = searchParams.get('stock') || stocks[0]?.id

    const handleStockChange = (value: string) => {
        const params = new URLSearchParams(searchParams)
        params.set('stock', value)
        // Reset to first page when changing stock
        params.delete('page')
        router.replace(`?${params.toString()}`)
    }

    if (stocks.length === 0) {
        return null
    }

    return (
        <div className="flex items-center gap-4">
            <Label htmlFor="stock-select">Stock</Label>
            <Select value={currentStock} onValueChange={handleStockChange}>
                <SelectTrigger id="stock-select" className="w-[200px]">
                    <SelectValue placeholder="Select stock" />
                </SelectTrigger>
                <SelectContent>
                    {stocks.map((stock) => (
                        <SelectItem key={stock.id} value={stock.id}>
                            {stock.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
