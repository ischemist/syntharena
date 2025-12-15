import { unstable_cache } from 'next/cache' // next 15 primitive
import { Prisma } from '@prisma/client'

import type { BuyableMetadata, MoleculeSearchResult, StockListItem, StockMoleculeFilters, VendorSource } from '@/types'
import prisma from '@/lib/db'

// ============================================================================
// 1. SELECTORS & TRANSFORMERS
// ============================================================================

// leaner selector: only fetch minimal data for the "other stocks" list
const minimalMoleculeSelector = {
    id: true,
    smiles: true,
    inchikey: true,
    // only fetch basic info for badges, no metadata
    stockItems: {
        select: {
            stock: { select: { id: true, name: true } },
        },
    },
} satisfies Prisma.MoleculeSelect

// helper to build where clause for stock items
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

    if (!conditions.length) return {}
    return { AND: conditions }
}

// ============================================================================
// 2. CORE READ OPERATIONS (Cached)
// ============================================================================

async function _getStocks(): Promise<StockListItem[]> {
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
export const getStocks = unstable_cache(_getStocks, ['stocks-list'], { tags: ['stocks'], revalidate: 3600 })

async function _getStockById(stockId: string): Promise<StockListItem> {
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
}
export const getStockById = unstable_cache(_getStockById, ['stock-by-id'], { tags: ['stocks'], revalidate: 3600 })

// CACHING: this is expensive (groupBy) and rarely changes. cache it hard.
// revalidate tag allows you to purge this when you upload a new csv.
async function _getStockMoleculeFilters(stockId: string): Promise<StockMoleculeFilters> {
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
}

export const getStockMoleculeFilters = unstable_cache(_getStockMoleculeFilters, ['stock-filters'], {
    tags: ['stocks'],
    revalidate: 3600,
})

// ============================================================================
// 3. OPTIMIZED SEARCH & BROWSE
// ============================================================================

// separate function for purely browsing a stock (no text search)
// uses stockItem table directly -> vastly faster index usage
async function browseStock(
    stockId: string,
    limit: number,
    offset: number,
    filters?: Parameters<typeof buildStockItemWhere>[0]
): Promise<MoleculeSearchResult> {
    const where: Prisma.StockItemWhereInput = {
        stockId,
        ...buildStockItemWhere(filters),
    }

    // run count and data in parallel
    const [total, stockItems] = await Promise.all([
        prisma.stockItem.count({ where }),
        prisma.stockItem.findMany({
            where,
            take: limit + 1,
            skip: offset,
            orderBy: { moleculeId: 'asc' },
            include: {
                molecule: {
                    select: minimalMoleculeSelector,
                },
            },
        }),
    ])

    const hasMore = stockItems.length > limit
    const items = hasMore ? stockItems.slice(0, limit) : stockItems

    // direct mapping: O(1) per item instead of O(N) searching
    const molecules = items.map((item) => ({
        id: item.molecule.id,
        smiles: item.molecule.smiles,
        inchikey: item.molecule.inchikey,
        stocks: item.molecule.stockItems.map((si) => ({
            id: si.stock.id,
            name: si.stock.name,
        })),
        stockItem: {
            id: item.id,
            ppg: item.ppg,
            source: item.source,
            leadTime: item.leadTime,
            link: item.link,
        },
    }))

    return { total, hasMore, molecules }
}

// separate function for text search (cross-stock or within stock)
// requires querying molecule table first
async function queryMolecules(
    query: string,
    stockId: string | undefined,
    limit: number,
    offset: number,
    filters?: Parameters<typeof buildStockItemWhere>[0]
): Promise<MoleculeSearchResult> {
    const sanitizedQuery = query.trim()

    // perf: "contains" on smiles is slow in sqlite.
    // nothing to do about it without fts5 or postgres, but ensure we limit the take.
    const where: Prisma.MoleculeWhereInput = {
        OR: [
            { smiles: { contains: sanitizedQuery } },
            { inchikey: { startsWith: sanitizedQuery.toUpperCase() } }, // startsWith uses index
        ],
    }

    const itemWhere = buildStockItemWhere(filters)
    const hasItemFilters = Object.keys(itemWhere).length > 0

    // optimize relation filter
    if (stockId || hasItemFilters) {
        where.stockItems = {
            some: {
                ...(stockId ? { stockId } : {}),
                ...itemWhere,
            },
        }
    }

    const [total, molecules] = await Promise.all([
        prisma.molecule.count({ where }),
        prisma.molecule.findMany({
            where,
            // we have to use the heavier selector here because we don't know
            // which stockItem belongs to the current context without looking
            include: {
                stockItems: {
                    include: { stock: { select: { id: true, name: true } } },
                },
            },
            take: limit + 1,
            skip: offset,
        }),
    ])

    const hasMore = molecules.length > limit
    const results = hasMore ? molecules.slice(0, limit) : molecules

    // use the lookup logic only when necessary (text search mode)
    const mapped = results.map((mol) => {
        // find context-specific item if stockId is provided
        const contextItem = stockId ? mol.stockItems.find((si) => si.stockId === stockId) : undefined

        return {
            id: mol.id,
            smiles: mol.smiles,
            inchikey: mol.inchikey,
            stocks: mol.stockItems.map((si) => ({
                id: si.stock.id,
                name: si.stock.name,
            })),
            stockItem: contextItem
                ? {
                      id: contextItem.id,
                      ppg: contextItem.ppg,
                      source: contextItem.source,
                      leadTime: contextItem.leadTime,
                      link: contextItem.link,
                  }
                : undefined,
        }
    })

    return { total, hasMore, molecules: mapped }
}

// unified entry point that dispatches to the optimized implementation
export async function searchMolecules(
    query: string = '',
    stockId?: string,
    limit: number = 24,
    offset: number = 0,
    filters?: Parameters<typeof buildStockItemWhere>[0]
): Promise<MoleculeSearchResult> {
    const take = Math.min(Math.max(1, limit), 1000)
    const skip = Math.max(0, offset)

    if (!query.trim() && stockId) {
        return browseStock(stockId, take, skip, filters)
    }

    return queryMolecules(query, stockId, take, skip, filters)
}
// ============================================================================
// 4. UTILITIES
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
