/**
 * data access layer for stock, stockitem, and molecule models.
 */
import { unstable_cache as cache } from 'next/cache'
import { Prisma } from '@prisma/client'

import prisma from '@/lib/db'

// ============================================================================
// selectors
// ============================================================================

const minimalMoleculeSelector = {
    id: true,
    smiles: true,
    inchikey: true,
    stockItems: {
        select: {
            stock: { select: { id: true, name: true } },
        },
    },
} satisfies Prisma.MoleculeSelect

// ============================================================================
// reads
// ============================================================================

/** finds all stocks for list views. */
async function _findStocks() {
    return prisma.stock.findMany({
        select: {
            id: true,
            name: true,
            description: true,
            _count: { select: { items: true } },
        },
        orderBy: { name: 'asc' },
    })
}
export const findStocks = cache(_findStocks, ['stocks-list'], { tags: ['stocks'] })

/** finds a single stock by its id. */
async function _findStockById(stockId: string) {
    const stock = await prisma.stock.findUnique({
        where: { id: stockId },
        select: {
            id: true,
            name: true,
            description: true,
            _count: { select: { items: true } },
        },
    })
    if (!stock) throw new Error('stock not found.')
    return stock
}
export const findStockById = cache(_findStockById, ['stock-by-id'], { tags: ['stocks'] })

/** aggregates filterable properties for a stock. expensive, so cache aggressively. */
async function _aggregateStockFilters(stockId: string) {
    const [stockCount, vendorAgg] = await Promise.all([
        prisma.stockItem.count({ where: { stockId } }),
        prisma.stockItem.groupBy({
            by: ['source'],
            where: { stockId, source: { not: null }, ppg: { not: null } },
            _count: true,
        }),
    ])

    return { total: stockCount, vendorAgg }
}
export const aggregateStockFilters = cache(_aggregateStockFilters, ['stock-filters'], {
    tags: ['stocks'],
})

/** checks which of a given set of inchikeys exist in a stock. */
export async function findInchiKeysInStock(inchikeyArray: string[], stockId: string): Promise<Set<string>> {
    if (inchikeyArray.length === 0) return new Set()
    const found = await prisma.molecule.findMany({
        where: {
            inchikey: { in: inchikeyArray },
            stockItems: { some: { stockId } },
        },
        select: { inchikey: true },
    })
    return new Set(found.map((m) => m.inchikey))
}

/**
 * [OPTIMIZED] fetches all relevant stock data for a set of inchikeys in a single query.
 * this function replaces `findInchiKeysInStock` and `findBuyableMetadata` to prevent redundant queries.
 */
async function _findStockDataForInchiKeys(inchikeyArray: string[], stockId: string) {
    if (inchikeyArray.length === 0) return []
    return prisma.stockItem.findMany({
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
}
export const findStockDataForInchiKeys = cache(_findStockDataForInchiKeys, ['stock-data-for-inchikeys'], {
    tags: ['stocks', 'molecules'],
})

/** browses a stock without a text query. optimized to use the stockitem table first. */
export async function browseStockItems(where: Prisma.StockItemWhereInput, limit: number, offset: number) {
    const [total, stockItems] = await Promise.all([
        prisma.stockItem.count({ where }),
        prisma.stockItem.findMany({
            where,
            take: limit + 1,
            skip: offset,
            orderBy: { moleculeId: 'asc' },
            include: { molecule: { select: minimalMoleculeSelector } },
        }),
    ])
    return { total, stockItems }
}

/** searches molecules with a text query. less optimal, queries molecule table first. */
export async function searchMoleculesByText(where: Prisma.MoleculeWhereInput, limit: number, offset: number) {
    const [total, molecules] = await Promise.all([
        prisma.molecule.count({ where }),
        prisma.molecule.findMany({
            where,
            include: { stockItems: { include: { stock: { select: { id: true, name: true } } } } },
            take: limit + 1,
            skip: offset,
        }),
    ])
    return { total, molecules }
}

/** fetches just the name of a stock by its id. */
async function _findStockNameById(stockId: string) {
    return prisma.stock.findUnique({
        where: { id: stockId },
        select: { name: true },
    })
}
export const findStockNameById = cache(_findStockNameById, ['stock-name-by-id'], {
    tags: ['stocks'],
})
