import { cache } from 'react'
import { Prisma } from '@prisma/client'

import type {
    BuyableMetadata,
    MoleculeSearchResult,
    MoleculeWithStocks,
    StockListItem,
    StockMoleculeFilters,
    VendorSource,
} from '@/types'
import prisma from '@/lib/db'

// ============================================================================
// Helpers & Types
// ============================================================================

const getStockItemFilter = (filters?: {
    vendors?: VendorSource[]
    minPpg?: number
    maxPpg?: number
    buyableOnly?: boolean
}): Prisma.StockItemWhereInput => {
    if (!filters) return {}

    const conditions: Prisma.StockItemWhereInput[] = []

    if (filters.vendors?.length) {
        conditions.push({ source: { in: filters.vendors } })
    }

    if (filters.minPpg !== undefined || filters.maxPpg !== undefined) {
        conditions.push({
            ppg: {
                gte: filters.minPpg,
                lte: filters.maxPpg,
            },
        })
    }

    if (filters.buyableOnly) {
        conditions.push({ source: { not: null }, ppg: { not: null } })
    }

    if (conditions.length === 0) return {}
    return conditions.length === 1 ? conditions[0] : { AND: conditions }
}

const moleculeSelector = {
    id: true,
    smiles: true,
    inchikey: true,
    stockItems: {
        select: {
            id: true,
            ppg: true,
            source: true,
            leadTime: true,
            link: true,
            stock: {
                select: { id: true, name: true },
            },
        },
    },
} satisfies Prisma.MoleculeSelect

// Type wrapper for the raw Prisma result based on the selector
type MoleculeWithStockRelations = Prisma.MoleculeGetPayload<{
    select: typeof moleculeSelector
}>

function transformMolecule(molecule: MoleculeWithStockRelations, currentStockId?: string): MoleculeWithStocks {
    // If we are browsing a specific stock, we want the metadata for THAT stock
    // explicitly extracted for the UI card
    const currentItem = currentStockId ? molecule.stockItems.find((si) => si.stock.id === currentStockId) : undefined

    return {
        id: molecule.id,
        smiles: molecule.smiles,
        inchikey: molecule.inchikey,
        stocks: molecule.stockItems.map((si) => ({
            id: si.stock.id,
            name: si.stock.name,
        })),
        stockItem: currentItem
            ? {
                  id: currentItem.id,
                  ppg: currentItem.ppg,
                  source: currentItem.source,
                  leadTime: currentItem.leadTime,
                  link: currentItem.link,
              }
            : undefined,
    }
}

// ============================================================================
// Core Read Operations
// ============================================================================

export async function getStocks(): Promise<StockListItem[]> {
    const stocks = await prisma.stock.findMany({
        include: { _count: { select: { items: true } } },
        orderBy: { name: 'asc' },
    })

    return stocks.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description || undefined,
        itemCount: s._count.items,
    }))
}

export const getStockById = cache(async (stockId: string): Promise<StockListItem> => {
    const stock = await prisma.stock.findUnique({
        where: { id: stockId },
        include: { _count: { select: { items: true } } },
    })

    if (!stock) throw new Error('Stock not found')

    return {
        id: stock.id,
        name: stock.name,
        description: stock.description || undefined,
        itemCount: stock._count.items,
    }
})

export const getStockMoleculeFilters = cache(async (stockId: string): Promise<StockMoleculeFilters> => {
    const [stockCount, vendorAgg] = await Promise.all([
        prisma.stock.findUnique({
            where: { id: stockId },
            select: { _count: { select: { items: true } } },
        }),
        prisma.stockItem.groupBy({
            by: ['source'],
            where: { stockId, source: { not: null }, ppg: { not: null } },
            _count: true,
        }),
    ])

    if (!stockCount) throw new Error('Stock not found')

    const buyableCount = vendorAgg.reduce((sum, item) => sum + item._count, 0)
    const total = stockCount._count.items

    return {
        availableVendors: vendorAgg
            .map((i) => i.source as VendorSource)
            .filter(Boolean)
            .sort(),
        counts: { total, buyable: buyableCount, nonBuyable: total - buyableCount },
    }
})

// ============================================================================
// Search & Browse
// ============================================================================

export async function searchMolecules(
    query: string = '',
    stockId?: string,
    limit: number = 24,
    offset: number = 0,
    filters?: {
        vendors?: VendorSource[]
        minPpg?: number
        maxPpg?: number
        buyableOnly?: boolean
    }
): Promise<MoleculeSearchResult> {
    const sanitizedQuery = query.trim()
    const take = Math.min(Math.max(1, limit), 1000)
    const skip = Math.max(0, offset)

    // PATH 1: BROWSE (No text query, specific stock)
    if (!sanitizedQuery && stockId) {
        const where: Prisma.StockItemWhereInput = {
            stockId,
            ...getStockItemFilter(filters),
        }

        const [total, stockItems] = await Promise.all([
            prisma.stockItem.count({ where }),
            prisma.stockItem.findMany({
                where,
                take: take + 1,
                skip,
                orderBy: { moleculeId: 'asc' },
                select: {
                    molecule: { select: moleculeSelector },
                },
            }),
        ])

        const hasMore = stockItems.length > take
        const items = hasMore ? stockItems.slice(0, take) : stockItems

        return {
            total,
            hasMore,
            molecules: items.map((i) => transformMolecule(i.molecule, stockId)),
        }
    }

    // PATH 2: SEARCH (Text query OR cross-stock search)
    const where: Prisma.MoleculeWhereInput = {}
    const itemFilters = getStockItemFilter(filters)
    const hasItemFilters = Object.keys(itemFilters).length > 0

    if (stockId || hasItemFilters) {
        where.stockItems = {
            some: {
                stockId,
                ...itemFilters,
            },
        }
    }

    if (sanitizedQuery) {
        where.OR = [
            { smiles: { contains: sanitizedQuery } },
            { inchikey: { startsWith: sanitizedQuery.toUpperCase() } },
        ]
    }

    const [total, molecules] = await Promise.all([
        prisma.molecule.count({ where }),
        prisma.molecule.findMany({
            where,
            select: moleculeSelector,
            take: take + 1,
            skip,
            orderBy: { smiles: 'asc' },
        }),
    ])

    const hasMore = molecules.length > take
    const results = hasMore ? molecules.slice(0, take) : molecules

    return {
        total,
        hasMore,
        molecules: results.map((m) => transformMolecule(m, stockId)),
    }
}

// Aliases for compatibility
export const getStockMolecules = (
    stockId: string,
    limit?: number,
    offset?: number,
    filters?: {
        vendors?: VendorSource[]
        minPpg?: number
        maxPpg?: number
        buyableOnly?: boolean
    }
) => searchMolecules('', stockId, limit, offset, filters)

export const searchStockMolecules = (query: string, stockId?: string, limit?: number, offset?: number) =>
    searchMolecules(query, stockId, limit, offset)

// ============================================================================
// Utilities
// ============================================================================

export async function checkMoleculesInStockByInchiKey(inchikeyArray: string[], stockId: string): Promise<Set<string>> {
    if (inchikeyArray.length === 0) return new Set()

    const molecules = await prisma.molecule.findMany({
        where: {
            inchikey: { in: inchikeyArray },
            stockItems: { some: { stockId } },
        },
        select: { inchikey: true },
    })

    return new Set(molecules.map((m) => m.inchikey))
}

export async function getBuyableMetadataForInchiKeys(
    inchikeyArray: string[],
    stockId: string
): Promise<Map<string, BuyableMetadata>> {
    if (!inchikeyArray.length) return new Map()

    const stockItems = await prisma.stockItem.findMany({
        where: {
            stockId,
            molecule: { inchikey: { in: inchikeyArray } },
        },
        select: {
            ppg: true,
            source: true,
            leadTime: true,
            link: true,
            molecule: { select: { inchikey: true } },
        },
    })

    const map = new Map<string, BuyableMetadata>()
    for (const item of stockItems) {
        map.set(item.molecule.inchikey, {
            ppg: item.ppg,
            source: item.source,
            leadTime: item.leadTime,
            link: item.link,
        })
    }
    return map
}

export async function deleteStock(stockId: string): Promise<void> {
    const exists = await prisma.stock.findUnique({ where: { id: stockId } })
    if (!exists) throw new Error('Stock not found')

    await prisma.$transaction([
        prisma.stockItem.deleteMany({ where: { stockId } }),
        prisma.stock.delete({ where: { id: stockId } }),
    ])
}
