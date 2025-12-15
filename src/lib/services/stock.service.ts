import { cache } from 'react'
import { unstable_cache } from 'next/cache' // next 15 primitive
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
// 1. SELECTORS & TRANSFORMERS
// ============================================================================

// leaner selector: only fetch minimal data for the "other stocks" list
const moleculeSelector = {
    id: true,
    smiles: true,
    inchikey: true,
    stockItems: {
        select: {
            id: true,
            stock: { select: { id: true, name: true } },
            // we'll fetch full metadata only for the current context via specialized query
            // or just eat the cost if we need to filter in JS (prisma limitation)
            ppg: true,
            source: true,
            leadTime: true,
            link: true,
        },
    },
} satisfies Prisma.MoleculeSelect

type MoleculeWithRelations = Prisma.MoleculeGetPayload<{
    select: typeof moleculeSelector
}>

function transformMolecule(molecule: MoleculeWithRelations, currentStockId?: string): MoleculeWithStocks {
    // fast lookup for the current stock's metadata
    // complexity: O(N) where N is stocks per molecule (usually small)
    const currentItem = currentStockId ? molecule.stockItems.find((si) => si.stock.id === currentStockId) : undefined

    return {
        id: molecule.id,
        smiles: molecule.smiles,
        inchikey: molecule.inchikey,
        // map purely for the badge list
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

export const getStocks = cache(async (): Promise<StockListItem[]> => {
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
})

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

// CACHING: this is expensive (groupBy) and rarely changes. cache it hard.
// revalidate tag allows you to purge this when you upload a new csv.
export const getStockMoleculeFilters = unstable_cache(
    async (stockId: string): Promise<StockMoleculeFilters> => {
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
    },
    ['stock-filters'], // key parts
    { tags: ['stocks'], revalidate: 3600 } // revalidate every hour or on tag invalidation
)

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

    const [total, stockItems] = await Promise.all([
        prisma.stockItem.count({ where }),
        prisma.stockItem.findMany({
            where,
            take: limit + 1, // fetch one extra to check hasMore
            skip: offset,
            orderBy: { moleculeId: 'asc' }, // consistent ordering
            select: {
                molecule: { select: moleculeSelector },
            },
        }),
    ])

    const hasMore = stockItems.length > limit
    const items = hasMore ? stockItems.slice(0, limit) : stockItems

    return {
        total,
        hasMore,
        molecules: items.map((i) => transformMolecule(i.molecule, stockId)),
    }
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

    // build combined where clause
    const where: Prisma.MoleculeWhereInput = {
        OR: [{ smiles: { contains: sanitizedQuery } }, { inchikey: { startsWith: sanitizedQuery.toUpperCase() } }],
    }

    // if filtering by stock or metadata, we need a relation filter
    const itemWhere = buildStockItemWhere(filters)
    const hasItemFilters = Object.keys(itemWhere).length > 0

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
            select: moleculeSelector,
            take: limit + 1,
            skip: offset,
            orderBy: { smiles: 'asc' }, // usually what people want with text search
        }),
    ])

    const hasMore = molecules.length > limit
    const results = hasMore ? molecules.slice(0, limit) : molecules

    return {
        total,
        hasMore,
        molecules: results.map((m) => transformMolecule(m, stockId)),
    }
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
