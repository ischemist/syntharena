import * as fs from 'fs/promises'
import { cache } from 'react'
import { Prisma } from '@prisma/client'

import type { Molecule, MoleculeSearchResult, MoleculeWithStocks, StockListItem } from '@/types'
import prisma from '@/lib/db'

// ============================================================================
// Stock Loading Functions
// ============================================================================

/**
 * Loads a stock from a CSV file into the database.
 * The file must have a header line "SMILES,InChi Key" followed by data rows.
 * This function is idempotent - running it multiple times with the same file
 * will not create duplicate molecules or stock items.
 *
 * @param filePath - Absolute path to the CSV file
 * @param stockName - Unique name for the stock (URL-safe recommended)
 * @param stockDescription - Optional description for the stock
 * @returns Statistics about the load operation
 * @throws Error if file doesn't exist, has invalid format, or stock name already exists
 */
export async function loadStockFromFile(
    filePath: string,
    stockName: string,
    stockDescription?: string
): Promise<{ stockId: string; moleculesCreated: number; moleculesSkipped: number; itemsCreated: number }> {
    // Validate file exists
    try {
        await fs.access(filePath)
    } catch {
        throw new Error(`File not found: ${filePath}`)
    }

    // Read and parse file
    const fileContent = await fs.readFile(filePath, 'utf-8')
    const lines = fileContent.split('\n').filter((line) => line.trim())

    if (lines.length < 2) {
        throw new Error('File must contain at least a header and one data row')
    }

    // Validate header
    const header = lines[0].trim().toLowerCase()
    if (!header.includes('smiles') || !header.includes('inchi')) {
        throw new Error('File must have header with SMILES and InChi Key columns')
    }

    // Parse data rows
    const moleculeData: Array<{ smiles: string; inchikey: string }> = []
    const skippedLines: Array<{ line: number; reason: string }> = []

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const parts = line.split(',')
        if (parts.length < 2) {
            skippedLines.push({ line: i + 1, reason: 'Invalid format (missing comma separator)' })
            continue
        }

        const smiles = parts[0].trim()
        const inchikey = parts[1].trim()

        if (!smiles || !inchikey) {
            skippedLines.push({ line: i + 1, reason: 'Empty SMILES or InChiKey' })
            continue
        }

        moleculeData.push({ smiles, inchikey })
    }

    if (moleculeData.length === 0) {
        throw new Error('No valid molecule data found in file')
    }

    // Log skipped lines if any (skip during tests)
    if (skippedLines.length > 0 && process.env.NODE_ENV !== 'test') {
        console.warn(`Skipped ${skippedLines.length} invalid lines:`)
        skippedLines.slice(0, 10).forEach(({ line, reason }) => {
            console.warn(`  Line ${line}: ${reason}`)
        })
        if (skippedLines.length > 10) {
            console.warn(`  ... and ${skippedLines.length - 10} more`)
        }
    }

    // Create or get stock
    let stock: { id: string; name: string; description: string | null }
    try {
        stock = await prisma.stock.create({
            data: {
                name: stockName,
                description: stockDescription || null,
            },
        })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new Error(
                `A stock with name "${stockName}" already exists. Use a different name or delete the existing stock.`
            )
        }
        throw error
    }

    // Process molecules in batches using transactions for consistency
    const BATCH_SIZE = 100
    let moleculesCreated = 0
    let moleculesSkipped = 0
    let itemsCreated = 0

    for (let i = 0; i < moleculeData.length; i += BATCH_SIZE) {
        const batch = moleculeData.slice(i, i + BATCH_SIZE)

        await prisma.$transaction(
            async (tx) => {
                for (const { smiles, inchikey } of batch) {
                    // Check if molecule exists before creating
                    let molecule: Molecule
                    try {
                        const existingMolecule = await tx.molecule.findUnique({
                            where: { inchikey },
                        })

                        if (existingMolecule) {
                            moleculesSkipped++
                            molecule = existingMolecule
                        } else {
                            molecule = await tx.molecule.create({
                                data: { smiles, inchikey },
                            })
                            moleculesCreated++
                        }
                    } catch (error) {
                        // If molecule creation fails, skip it
                        if (process.env.NODE_ENV !== 'test') {
                            console.warn(`Failed to process molecule ${inchikey}: ${error}`)
                        }
                        moleculesSkipped++
                        continue
                    }

                    // Create stock item if it doesn't exist
                    try {
                        await tx.stockItem.create({
                            data: {
                                stockId: stock.id,
                                moleculeId: molecule.id,
                            },
                        })
                        itemsCreated++
                    } catch (error) {
                        // If stock item already exists (duplicate), skip silently
                        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                            // Unique constraint violation - item already exists
                            continue
                        }
                        throw error
                    }
                }
            },
            {
                timeout: 30000, // 30 second timeout for large batches
            }
        )

        // Log progress (skip during tests)
        if (process.env.NODE_ENV !== 'test') {
            const processed = Math.min(i + BATCH_SIZE, moleculeData.length)
            console.log(`Processed ${processed}/${moleculeData.length} molecules...`)
        }
    }

    return {
        stockId: stock.id,
        moleculesCreated,
        moleculesSkipped,
        itemsCreated,
    }
}

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
 * Retrieves a stock by name with case-insensitive fuzzy matching.
 * Tries exact match first, then falls back to contains matching.
 *
 * @param stockName - The stock name to search for
 * @returns Stock with itemCount, or null if not found
 */
async function _getStockByName(stockName: string): Promise<StockListItem | null> {
    // Fetch all stocks and do case-insensitive matching in memory
    // This is acceptable since stock count is typically small (<100)
    const stocks = await prisma.stock.findMany({
        include: {
            _count: {
                select: { items: true },
            },
        },
    })

    // Try exact match first (case-insensitive)
    let stock = stocks.find((s) => s.name.toLowerCase() === stockName.toLowerCase())

    // Fall back to contains if exact match fails
    if (!stock) {
        stock = stocks.find((s) => s.name.toLowerCase().includes(stockName.toLowerCase()))
    }

    if (!stock) {
        return null
    }

    return {
        id: stock.id,
        name: stock.name,
        description: stock.description || undefined,
        itemCount: stock._count.items,
    }
}

export const getStockByName = cache(_getStockByName)

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
 * @returns Molecules in the stock with pagination metadata
 */
export async function getStockMolecules(
    stockId: string,
    limit: number = 24,
    offset: number = 0
): Promise<{ molecules: MoleculeWithStocks[]; total: number; hasMore: boolean }> {
    // Sanitize and validate inputs
    const validLimit = Math.min(Math.max(1, limit), 1000)
    const validOffset = Math.max(0, offset)

    // 1. Get total from metadata (instant)
    const stock = await prisma.stock.findUnique({
        where: { id: stockId },
        select: {
            _count: {
                select: { items: true },
            },
        },
    })

    if (!stock) throw new Error('Stock not found')
    const total = stock._count.items

    // 2. Efficient Index Walk on StockItem
    const stockItems = await prisma.stockItem.findMany({
        where: { stockId },
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
 * @returns Search results with pagination metadata
 */
export async function searchMolecules(
    query: string,
    stockId?: string,
    limit: number = 24,
    offset: number = 0
): Promise<{ molecules: MoleculeWithStocks[]; total: number; hasMore: boolean }> {
    // Sanitize and validate inputs
    const sanitizedQuery = query.trim()
    const validLimit = Math.min(Math.max(1, limit), 1000)
    const validOffset = Math.max(0, offset)

    // Build filters
    const baseFilter = stockId ? { stockItems: { some: { stockId } } } : {}
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

    const transformedMolecules = resultMolecules.map((molecule) => ({
        id: molecule.id,
        smiles: molecule.smiles,
        inchikey: molecule.inchikey,
        stocks: molecule.stockItems.map((item) => ({
            id: item.stock.id,
            name: item.stock.name,
        })),
    }))

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
