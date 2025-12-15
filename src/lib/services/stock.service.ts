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
// Stock Query Functions
// ============================================================================

/**
 * Retrieves all stocks with their molecule counts.
 *
 * @returns Array of stocks with itemCount
 */
export async function getStocks(): Promise<StockListItem[]> {
    const stocks = await prisma.stock.findMany({
        include: {
            _count: {
                select: { items: true },
            },
        },
        orderBy: { name: 'asc' },
    })

    return stocks.map((stock) => ({
        id: stock.id,
        name: stock.name,
        description: stock.description || undefined,
        itemCount: stock._count.items,
    }))
}

/**
 * Retrieves a single stock by ID with its molecule count.
 *
 * @param stockId - The stock ID
 * @returns Stock with itemCount
 * @throws Error if stock not found
 */
async function _getStockById(stockId: string): Promise<StockListItem> {
    const stock = await prisma.stock.findUnique({
        where: { id: stockId },
        include: {
            _count: {
                select: { items: true },
            },
        },
    })

    if (!stock) {
        throw new Error('Stock not found')
    }

    return {
        id: stock.id,
        name: stock.name,
        description: stock.description || undefined,
        itemCount: stock._count.items,
    }
}

export const getStockById = cache(_getStockById)

/**
 * Retrieves filter statistics for a stock's molecules.
 * Used to populate filter controls with available vendors and counts.
 *
 * @param stockId - The stock ID
 * @returns Filter statistics including available vendors and buyable counts
 * @throws Error if stock not found
 */
export async function getStockMoleculeFilters(stockId: string): Promise<StockMoleculeFilters> {
    // Verify stock exists and get total count
    const stock = await prisma.stock.findUnique({
        where: { id: stockId },
        select: {
            _count: {
                select: { items: true },
            },
        },
    })

    if (!stock) {
        throw new Error('Stock not found')
    }

    // Get unique vendors and count buyable items efficiently
    const vendorAggregation = await prisma.stockItem.groupBy({
        by: ['source'],
        where: {
            stockId,
            source: { not: null },
            ppg: { not: null },
        },
        _count: true,
    })

    // Extract unique vendors
    const availableVendors = vendorAggregation
        .map((item) => item.source as VendorSource)
        .filter(Boolean)
        .sort()

    // Count buyable items
    const buyableCount = vendorAggregation.reduce((sum, item) => sum + item._count, 0)
    const total = stock._count.items

    return {
        availableVendors,
        counts: {
            total,
            buyable: buyableCount,
            nonBuyable: total - buyableCount,
        },
    }
}

/**
 * Searches for molecules by SMILES or InChiKey with optional stock filtering.
 * Uses prefix matching for efficient indexed search.
 * If no query is provided, returns all molecules (optionally filtered by stock).
 *
 * @param query - Optional search term (SMILES or InChiKey prefix). If empty, shows all molecules.
 * @param stockId - Optional stock ID to filter results
 * @param limit - Maximum number of results (default 50, max 1000)
 * @param offset - Number of results to skip for pagination (default 0)
 * @returns Search results with molecules and pagination info
 */
export async function searchStockMolecules(
    query: string = '',
    stockId?: string,
    limit: number = 50,
    offset: number = 0
): Promise<MoleculeSearchResult> {
    // Sanitize and validate inputs
    const sanitizedQuery = query.trim()
    const validLimit = Math.min(Math.max(1, limit), 1000)
    const validOffset = Math.max(0, offset)

    // Build base filter (stock filtering)
    const baseFilter = stockId
        ? {
              stockItems: {
                  some: { stockId },
              },
          }
        : {}

    // Build search filter (only if query provided)
    const searchFilter = sanitizedQuery
        ? {
              OR: [
                  { smiles: { contains: sanitizedQuery } }, // SQLite is case-insensitive by default
                  { inchikey: { startsWith: sanitizedQuery.toUpperCase() } },
              ],
          }
        : {}

    // Combine filters
    const whereClause =
        sanitizedQuery && stockId
            ? { AND: [baseFilter, searchFilter] }
            : sanitizedQuery
              ? searchFilter
              : stockId
                ? baseFilter
                : {} // No filters = all molecules

    // Execute query with pagination
    const [molecules, total] = await Promise.all([
        prisma.molecule.findMany({
            where: whereClause,
            select: {
                id: true,
                smiles: true,
                inchikey: true,
            },
            take: validLimit + 1, // Fetch one extra to check if there are more results
            skip: validOffset,
            orderBy: { smiles: 'asc' },
        }),
        prisma.molecule.count({ where: whereClause }),
    ])

    // Check if there are more results
    const hasMore = molecules.length > validLimit
    const resultMolecules = hasMore ? molecules.slice(0, validLimit) : molecules

    return {
        molecules: resultMolecules,
        total,
        hasMore,
    }
}

/**
 * Fast path for browsing a specific stock.
 * Uses the primary index on StockItem to efficiently paginate through molecules
 * without needing to sort the entire Molecule table.
 *
 * Use this when:
 * 1. Filtering by a specific stock ID
 * 2. NO text search query is present
 *
 * @param stockId - The stock ID to browse
 * @param limit - Max results (default 24)
 * @param offset - Pagination offset
 * @param filters - Optional filters (vendors, price range, buyable only)
 * @returns Molecules in the stock with pagination metadata
 */
export async function getStockMolecules(
    stockId: string,
    limit: number = 24,
    offset: number = 0,
    filters?: {
        vendors?: VendorSource[]
        minPpg?: number
        maxPpg?: number
        buyableOnly?: boolean
    }
): Promise<{ molecules: MoleculeWithStocks[]; total: number; hasMore: boolean }> {
    // Sanitize and validate inputs
    const validLimit = Math.min(Math.max(1, limit), 1000)
    const validOffset = Math.max(0, offset)

    // Build filter conditions using AND array for clean composition
    const conditions: Prisma.StockItemWhereInput[] = [{ stockId }]

    // Apply vendor filter
    if (filters?.vendors && filters.vendors.length > 0) {
        conditions.push({ source: { in: filters.vendors } })
    }

    // Apply price range filters
    if (filters?.minPpg !== undefined || filters?.maxPpg !== undefined) {
        const ppgFilter: { gte?: number; lte?: number } = {}
        if (filters.minPpg !== undefined) {
            ppgFilter.gte = filters.minPpg
        }
        if (filters.maxPpg !== undefined) {
            ppgFilter.lte = filters.maxPpg
        }
        conditions.push({ ppg: ppgFilter })
    }

    // Apply buyable only filter
    if (filters?.buyableOnly) {
        conditions.push({ source: { not: null } })
        conditions.push({ ppg: { not: null } })
    }

    const whereClause: Prisma.StockItemWhereInput = conditions.length === 1 ? conditions[0] : { AND: conditions }

    // 1. Get total count with filters
    const total = await prisma.stockItem.count({ where: whereClause })

    if (!total) {
        return { molecules: [], total: 0, hasMore: false }
    }

    // 2. Efficient Index Walk on StockItem with filters
    const stockItems = await prisma.stockItem.findMany({
        where: whereClause,
        take: validLimit + 1,
        skip: validOffset,
        orderBy: { moleculeId: 'asc' }, // Stable sort using index
        include: {
            molecule: {
                include: {
                    stockItems: {
                        include: {
                            stock: { select: { id: true, name: true } },
                        },
                    },
                },
            },
        },
    })

    const hasMore = stockItems.length > validLimit
    const resultItems = hasMore ? stockItems.slice(0, validLimit) : stockItems

    const molecules = resultItems.map((item) => ({
        id: item.molecule.id,
        smiles: item.molecule.smiles,
        inchikey: item.molecule.inchikey,
        stocks: item.molecule.stockItems.map((si) => ({
            id: si.stock.id,
            name: si.stock.name,
        })),
        // Include buyable metadata from the current stock item
        stockItem: {
            id: item.id,
            ppg: item.ppg,
            source: item.source,
            leadTime: item.leadTime,
            link: item.link,
        },
    }))

    return { molecules, total, hasMore }
}

/**
 * Slow path for searching molecules by SMILES/InChiKey.
 * Performs a text scan on the Molecule table, optionally filtered by stock.
 * This is computationally more expensive than getStockMolecules due to text matching.
 *
 * Use this when:
 * 1. A search query string is present (e.g. "benzene")
 * 2. OR searching across ALL stocks (no stockId)
 *
 * @param query - The search string (SMILES substring or InChiKey prefix)
 * @param stockId - Optional stock ID to filter results
 * @param limit - Max results (default 24)
 * @param offset - Pagination offset
 * @param filters - Optional filters (vendors, price range, buyable only)
 * @returns Search results with pagination metadata
 */
export async function searchMolecules(
    query: string,
    stockId?: string,
    limit: number = 24,
    offset: number = 0,
    filters?: {
        vendors?: VendorSource[]
        minPpg?: number
        maxPpg?: number
        buyableOnly?: boolean
    }
): Promise<{ molecules: MoleculeWithStocks[]; total: number; hasMore: boolean }> {
    // Sanitize and validate inputs
    const sanitizedQuery = query.trim()
    const validLimit = Math.min(Math.max(1, limit), 1000)
    const validOffset = Math.max(0, offset)

    // Build base filter (stock filtering) using AND array for clean composition
    const baseFilter: Prisma.MoleculeWhereInput = {}

    if (
        stockId ||
        filters?.vendors ||
        filters?.minPpg !== undefined ||
        filters?.maxPpg !== undefined ||
        filters?.buyableOnly
    ) {
        const stockItemConditions: Prisma.StockItemWhereInput[] = []

        if (stockId) {
            stockItemConditions.push({ stockId })
        }

        if (filters?.vendors && filters.vendors.length > 0) {
            stockItemConditions.push({ source: { in: filters.vendors } })
        }

        if (filters?.minPpg !== undefined || filters?.maxPpg !== undefined) {
            const ppgFilter: { gte?: number; lte?: number } = {}
            if (filters.minPpg !== undefined) {
                ppgFilter.gte = filters.minPpg
            }
            if (filters.maxPpg !== undefined) {
                ppgFilter.lte = filters.maxPpg
            }
            stockItemConditions.push({ ppg: ppgFilter })
        }

        if (filters?.buyableOnly) {
            stockItemConditions.push({ source: { not: null } })
            stockItemConditions.push({ ppg: { not: null } })
        }

        const stockItemFilter: Prisma.StockItemWhereInput =
            stockItemConditions.length === 1 ? stockItemConditions[0] : { AND: stockItemConditions }

        baseFilter.stockItems = { some: stockItemFilter }
    }

    const searchFilter = {
        OR: [{ smiles: { contains: sanitizedQuery } }, { inchikey: { startsWith: sanitizedQuery.toUpperCase() } }],
    }

    const whereClause = { AND: [baseFilter, searchFilter] }

    const [molecules, total] = await Promise.all([
        prisma.molecule.findMany({
            where: whereClause,
            include: {
                stockItems: {
                    include: {
                        stock: { select: { id: true, name: true } },
                    },
                },
            },
            take: validLimit + 1,
            skip: validOffset,
            orderBy: { smiles: 'asc' }, // Sorting here is unavoidable but filtered
        }),
        prisma.molecule.count({ where: whereClause }),
    ])

    const hasMore = molecules.length > validLimit
    const resultMolecules = hasMore ? molecules.slice(0, validLimit) : molecules

    const transformedMolecules = resultMolecules.map((molecule) => {
        // Find the stock item for the current stock filter (if applicable)
        const currentStockItem = stockId ? molecule.stockItems.find((item) => item.stock.id === stockId) : undefined

        return {
            id: molecule.id,
            smiles: molecule.smiles,
            inchikey: molecule.inchikey,
            stocks: molecule.stockItems.map((item) => ({
                id: item.stock.id,
                name: item.stock.name,
            })),
            // Include buyable metadata from the filtered stock item (if searching within a specific stock)
            stockItem: currentStockItem
                ? {
                      id: currentStockItem.id,
                      ppg: currentStockItem.ppg,
                      source: currentStockItem.source,
                      leadTime: currentStockItem.leadTime,
                      link: currentStockItem.link,
                  }
                : undefined,
        }
    })

    return { molecules: transformedMolecules, total, hasMore }
}

/**
 * Fetches a molecule with all stocks it appears in.
 * Used for displaying cross-stock information in the UI.
 *
 * @param moleculeId - The molecule ID
 * @returns Molecule with array of stocks it appears in
 * @throws Error if molecule not found
 */
export async function getMoleculeWithStocks(moleculeId: string): Promise<MoleculeWithStocks> {
    const molecule = await prisma.molecule.findUnique({
        where: { id: moleculeId },
        include: {
            stockItems: {
                include: {
                    stock: {
                        select: { id: true, name: true },
                    },
                },
            },
        },
    })

    if (!molecule) {
        throw new Error('Molecule not found')
    }

    return {
        id: molecule.id,
        inchikey: molecule.inchikey,
        smiles: molecule.smiles,
        stocks: molecule.stockItems.map((item) => ({
            id: item.stock.id,
            name: item.stock.name,
        })),
    }
}

/**
 * Fetches multiple molecules with their cross-stock information.
 * Batch operation for efficiency.
 *
 * @param moleculeIds - Array of molecule IDs
 * @returns Array of molecules with their stocks
 */
export async function getMoleculesWithStocks(moleculeIds: string[]): Promise<MoleculeWithStocks[]> {
    const molecules = await prisma.molecule.findMany({
        where: { id: { in: moleculeIds } },
        include: {
            stockItems: {
                include: {
                    stock: {
                        select: { id: true, name: true },
                    },
                },
            },
        },
    })

    return molecules.map((molecule) => ({
        id: molecule.id,
        inchikey: molecule.inchikey,
        smiles: molecule.smiles,
        stocks: molecule.stockItems.map((item) => ({
            id: item.stock.id,
            name: item.stock.name,
        })),
    }))
}

/**
 * Deletes a stock and all its stock items.
 * Does NOT delete the molecules themselves (they may be in other stocks).
 *
 * @param stockId - The stock ID to delete
 * @throws Error if stock not found
 */
export async function deleteStock(stockId: string): Promise<void> {
    const stock = await prisma.stock.findUnique({
        where: { id: stockId },
    })

    if (!stock) {
        throw new Error('Stock not found')
    }

    // Delete in transaction
    await prisma.$transaction([
        prisma.stockItem.deleteMany({ where: { stockId } }),
        prisma.stock.delete({ where: { id: stockId } }),
    ])
}

/**
 * Batch checks if molecules (by SMILES) exist in a stock.
 * Returns a Set of SMILES strings that are in stock.
 *
 * @param smilesArray - Array of SMILES strings to check
 * @param stockId - The stock ID to check against
 * @returns Set of SMILES strings that exist in the stock
 * @deprecated Use checkMoleculesInStockByInchiKey for reliable molecule comparison
 */
export async function checkMoleculesInStock(smilesArray: string[], stockId: string): Promise<Set<string>> {
    if (smilesArray.length === 0) {
        return new Set()
    }

    // Query molecules that match the SMILES and exist in the stock
    const moleculesInStock = await prisma.molecule.findMany({
        where: {
            smiles: { in: smilesArray },
            stockItems: {
                some: { stockId },
            },
        },
        select: { smiles: true },
    })

    // Return as Set for O(1) lookup
    return new Set(moleculesInStock.map((mol) => mol.smiles))
}

/**
 * Batch checks if molecules (by InChiKey) exist in a stock.
 * Returns a Set of InChiKey strings that are in stock.
 * InChiKeys are canonical identifiers, making this more reliable than SMILES comparison.
 *
 * @param inchikeyArray - Array of InChiKey strings to check
 * @param stockId - The stock ID to check against
 * @returns Set of InChiKey strings that exist in the stock
 */
export async function checkMoleculesInStockByInchiKey(inchikeyArray: string[], stockId: string): Promise<Set<string>> {
    if (inchikeyArray.length === 0) {
        return new Set()
    }

    // Query molecules that match the InChiKeys and exist in the stock
    const moleculesInStock = await prisma.molecule.findMany({
        where: {
            inchikey: { in: inchikeyArray },
            stockItems: {
                some: { stockId },
            },
        },
        select: { inchikey: true },
    })

    // Return as Set for O(1) lookup
    return new Set(moleculesInStock.map((mol) => mol.inchikey))
}

/**
 * Batch fetches buyable metadata for molecules (by InChiKey) in a specific stock.
 * Returns a Map of InChiKey → metadata for molecules that exist in the stock.
 * Used for enriching route visualizations with commercial availability information.
 *
 * @param inchikeyArray - Array of InChiKey strings to fetch metadata for
 * @param stockId - The stock ID to query
 * @returns Map of InChiKey → BuyableMetadata for molecules in stock
 */
export async function getBuyableMetadataForInchiKeys(
    inchikeyArray: string[],
    stockId: string
): Promise<Map<string, BuyableMetadata>> {
    if (inchikeyArray.length === 0) {
        return new Map()
    }

    // Query stock items with molecule and metadata
    const stockItems = await prisma.stockItem.findMany({
        where: {
            stockId,
            molecule: {
                inchikey: { in: inchikeyArray },
            },
        },
        select: {
            ppg: true,
            source: true,
            leadTime: true,
            link: true,
            molecule: {
                select: { inchikey: true },
            },
        },
    })

    // Build map for O(1) lookup
    const metadataMap = new Map<string, BuyableMetadata>()
    for (const item of stockItems) {
        metadataMap.set(item.molecule.inchikey, {
            ppg: item.ppg,
            source: item.source,
            leadTime: item.leadTime,
            link: item.link,
        })
    }

    return metadataMap
}
