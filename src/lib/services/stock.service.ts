import * as fs from 'fs/promises'
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

    // Log skipped lines if any
    if (skippedLines.length > 0) {
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

    // Process molecules in batches
    const BATCH_SIZE = 500
    let moleculesCreated = 0
    let moleculesSkipped = 0
    let itemsCreated = 0

    for (let i = 0; i < moleculeData.length; i += BATCH_SIZE) {
        const batch = moleculeData.slice(i, i + BATCH_SIZE)

        await prisma.$transaction(async (tx) => {
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
                    console.warn(`Failed to process molecule ${inchikey}: ${error}`)
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
        })

        // Log progress
        const processed = Math.min(i + BATCH_SIZE, moleculeData.length)
        console.log(`Processed ${processed}/${moleculeData.length} molecules...`)
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
export async function getStockById(stockId: string): Promise<StockListItem> {
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
 * Searches for molecules by SMILES or InChiKey with optional stock filtering.
 * Returns molecules with their cross-stock information in a single optimized query.
 * This avoids the N+1 query problem by fetching related stocks in the same query.
 *
 * @param query - Optional search term (SMILES or InChiKey prefix). If empty, shows all molecules.
 * @param stockId - Optional stock ID to filter results
 * @param limit - Maximum number of results (default 50, max 1000)
 * @param offset - Number of results to skip for pagination (default 0)
 * @returns Search results with molecules (including stocks) and pagination info
 */
export async function searchStockMoleculesWithStocks(
    query: string = '',
    stockId?: string,
    limit: number = 50,
    offset: number = 0
): Promise<{ molecules: MoleculeWithStocks[]; total: number; hasMore: boolean }> {
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
                  { smiles: { contains: sanitizedQuery } },
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
                : {}

    // Execute query with pagination - include stocks in main query
    const [molecules, total] = await Promise.all([
        prisma.molecule.findMany({
            where: whereClause,
            include: {
                stockItems: {
                    include: {
                        stock: {
                            select: { id: true, name: true },
                        },
                    },
                },
            },
            take: validLimit + 1,
            skip: validOffset,
            orderBy: { smiles: 'asc' },
        }),
        prisma.molecule.count({ where: whereClause }),
    ])

    // Check if there are more results
    const hasMore = molecules.length > validLimit
    const resultMolecules = hasMore ? molecules.slice(0, validLimit) : molecules

    // Transform to MoleculeWithStocks format
    const transformedMolecules: MoleculeWithStocks[] = resultMolecules.map((molecule) => ({
        id: molecule.id,
        smiles: molecule.smiles,
        inchikey: molecule.inchikey,
        stocks: molecule.stockItems.map((item) => ({
            id: item.stock.id,
            name: item.stock.name,
        })),
    }))

    return {
        molecules: transformedMolecules,
        total,
        hasMore,
    }
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
