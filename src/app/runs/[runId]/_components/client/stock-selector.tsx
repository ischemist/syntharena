'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function StockSelector() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const currentStock = searchParams.get('stock') || 'all'

    const handleStockChange = (value: string) => {
        const params = new URLSearchParams(searchParams)
        if (value === 'all') {
            params.delete('stock')
        } else {
            params.set('stock', value)
        }
        // Reset to first page when changing stock
        params.delete('page')
        router.replace(`?${params.toString()}`)
    }

    return (
        <div className="flex items-center gap-4">
            <Label htmlFor="stock-select">Stock</Label>
            <Select value={currentStock} onValueChange={handleStockChange}>
                <SelectTrigger id="stock-select" className="w-[200px]">
                    <SelectValue placeholder="Select stock" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Stocks</SelectItem>
                    <SelectItem value="buyables-stock">Buyables Stock</SelectItem>
                    <SelectItem value="n5-stock">N5 Stock</SelectItem>
                </SelectContent>
            </Select>
        </div>
    )
}
