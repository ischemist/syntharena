'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import type { StockListItem } from '@/types'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface StockSelectorProps {
    stocks: StockListItem[]
    hasStock: boolean
    hasTarget: boolean
    firstTargetId?: string
}

export function StockSelector({ stocks, hasStock, hasTarget, firstTargetId }: StockSelectorProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const currentStock = searchParams.get('stock') || stocks[0]?.id

    // Phase 5: Client-side default selection on mount
    useEffect(() => {
        const params = new URLSearchParams(searchParams)
        let needsUpdate = false

        // Auto-select first stock if none selected
        if (!hasStock && stocks.length > 0) {
            params.set('stock', stocks[0].id)
            needsUpdate = true
        }

        // Auto-select first target if none selected
        if (!hasTarget && firstTargetId) {
            params.set('target', firstTargetId)
            params.set('rank', '1')
            needsUpdate = true
        }

        if (needsUpdate) {
            router.replace(`?${params.toString()}`, { scroll: false })
        }
    }, [hasStock, hasTarget, stocks, firstTargetId, searchParams, router])

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
