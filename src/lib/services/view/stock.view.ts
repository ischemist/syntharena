/**
 * view model composition layer for stocks.
 * builds DTOs for stock browsing and searching.
 */
import { Prisma, type VendorSource } from '@prisma/client'

import type { MoleculeSearchResult, StockListItem, StockMoleculeFilters } from '@/types'
import * as stockData from '@/lib/services/data/stock.data'

// ============================================================================
// DTO builders
// ============================================================================

export async function getStocks(): Promise<StockListItem[]> {
    const stocks = await stockData.findStocks()
    return stocks.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description || undefined,
        itemCount: s._count.items,
    }))
}

export async function getStockById(stockId: string): Promise<StockListItem> {
    const s = await stockData.findStockById(stockId)
    return {
        id: s.id,
        name: s.name,
        description: s.description || undefined,
        itemCount: s._count.items,
    }
}

export async function getStockMoleculeFilters(stockId: string): Promise<StockMoleculeFilters> {
    const { total, vendorAgg } = await stockData.aggregateStockFilters(stockId)
    const buyableCount = vendorAgg.reduce((sum, item) => sum + item._count, 0)
    return {
        availableVendors: vendorAgg.map((i) => i.source as VendorSource).filter(Boolean),
        counts: { total, buyable: buyableCount, nonBuyable: total - buyableCount },
    }
}

// ============================================================================
// search orchestration
// ============================================================================

const buildStockItemWhere = (filters?: {
    vendors?: VendorSource[]
    minPpg?: number
    maxPpg?: number
    buyableOnly?: boolean
}): Prisma.StockItemWhereInput => {
    if (!filters) return {}
    const conditions: Prisma.StockItemWhereInput[] = []
    if (filters.vendors?.length) conditions.push({ source: { in: filters.vendors } })
    if (filters.minPpg !== undefined) conditions.push({ ppg: { gte: filters.minPpg } })
    if (filters.maxPpg !== undefined) conditions.push({ ppg: { lte: filters.maxPpg } })
    if (filters.buyableOnly) conditions.push({ source: { not: null }, ppg: { not: null } })
    return conditions.length ? { AND: conditions } : {}
}

export async function searchMolecules(
    query: string = '',
    stockId?: string,
    limit: number = 24,
    offset: number = 0,
    filters?: Parameters<typeof buildStockItemWhere>[0]
): Promise<MoleculeSearchResult> {
    const take = Math.min(Math.max(1, limit), 1000)
    const skip = Math.max(0, offset)
    const sanitizedQuery = query.trim()

    if (!sanitizedQuery && stockId) {
        // optimized path: browsing a single stock
        const where: Prisma.StockItemWhereInput = { stockId, ...buildStockItemWhere(filters) }
        const { total, stockItems } = await stockData.browseStockItems(where, take, skip)

        const hasMore = stockItems.length > take
        const items = hasMore ? stockItems.slice(0, take) : stockItems
        const molecules = items.map((item) => ({
            id: item.molecule.id,
            smiles: item.molecule.smiles,
            inchikey: item.molecule.inchikey,
            stocks: item.molecule.stockItems.map((si) => si.stock),
            stockItem: item,
        }))
        return { total, hasMore, molecules }
    } else {
        // text search path
        const where: Prisma.MoleculeWhereInput = {
            OR: [{ smiles: { contains: sanitizedQuery } }, { inchikey: { startsWith: sanitizedQuery.toUpperCase() } }],
        }

        const itemWhere = buildStockItemWhere(filters)
        if (stockId || Object.keys(itemWhere).length) {
            where.stockItems = { some: { ...(stockId && { stockId }), ...itemWhere } }
        }

        const { total, molecules } = await stockData.searchMoleculesByText(where, take, skip)

        const hasMore = molecules.length > take
        const results = hasMore ? molecules.slice(0, take) : molecules
        const mapped = results.map((mol) => ({
            id: mol.id,
            smiles: mol.smiles,
            inchikey: mol.inchikey,
            stocks: mol.stockItems.map((si) => si.stock),
            stockItem: stockId ? mol.stockItems.find((si) => si.stockId === stockId) : undefined,
        }))
        return { total, hasMore, molecules: mapped }
    }
}
