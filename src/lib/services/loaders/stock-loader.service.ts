import crypto from 'crypto'
import * as fs from 'fs/promises'
import * as zlib from 'zlib'
import { createId } from '@paralleldrive/cuid2'

import type { StockListItem, VendorSource } from '@/types'
import prisma from '@/lib/db'

/**
 * Retrieves a stock by name with case-insensitive exact matching.
 * This ensures deterministic stock associations for loading scripts.
 *
 * @param stockName - The stock name to search for (case-insensitive)
 * @returns Stock with itemCount, or null if not found
 */
export async function getStockByName(stockName: string): Promise<StockListItem | null> {
    // Fetch all stocks and do case-insensitive matching in memory
    // This is acceptable since stock count is typically small (<100)
    const stocks = await prisma.stock.findMany({
        include: {
            _count: {
                select: { items: true },
            },
        },
    })

    // Exact match only (case-insensitive) to prevent ambiguous associations
    const stock = stocks.find((s) => s.name.toLowerCase() === stockName.toLowerCase())

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
interface StockProvenance {
    sourcePath?: string
    sourceSha256?: string
    schemaVersion?: string
}

export async function loadStockFromFile(
    filePath: string,
    stockName: string,
    stockDescription?: string,
    provenance: StockProvenance = {}
): Promise<{
    stockId: string
    moleculesCreated: number
    moleculesSkipped: number
    itemsCreated: number
}> {
    // Validate file exists
    try {
        await fs.access(filePath)
    } catch {
        throw new Error(`File not found: ${filePath}`)
    }

    const fileBytes = await fs.readFile(filePath)
    return loadStockFromBytes(fileBytes, filePath.endsWith('.gz'), stockName, stockDescription, provenance)
}

/**
 * Loads a stock from bytes already captured and verified by the caller. Corpus
 * rebuilds use this boundary so the digest and parsed rows necessarily describe
 * the same immutable byte sequence.
 */
export async function loadStockFromBytes(
    fileBytes: Buffer,
    compressed: boolean,
    stockName: string,
    stockDescription?: string,
    provenance: StockProvenance = {}
): Promise<{
    stockId: string
    moleculesCreated: number
    moleculesSkipped: number
    itemsCreated: number
}> {
    const fileContent = (compressed ? zlib.gunzipSync(fileBytes) : fileBytes).toString('utf-8')
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
    const moleculesByInchikey = new Map<string, { smiles: string; inchikey: string }>()
    const skippedLines: Array<{ line: number; reason: string }> = []

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const parts = line.split(',')
        if (parts.length < 2) {
            skippedLines.push({
                line: i + 1,
                reason: 'Invalid format (missing comma separator)',
            })
            continue
        }

        const smiles = parts[0].trim()
        const inchikey = parts[1].trim()

        if (!smiles || !inchikey) {
            skippedLines.push({ line: i + 1, reason: 'Empty SMILES or InChiKey' })
            continue
        }

        const existing = moleculesByInchikey.get(inchikey)
        if (existing && existing.smiles !== smiles) {
            throw new Error(`Stock ${stockName} assigns multiple SMILES to InChIKey ${inchikey}`)
        }
        moleculesByInchikey.set(inchikey, { smiles, inchikey })
    }

    const moleculeData = [...moleculesByInchikey.values()]
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

    const sourceSha256 = provenance.sourceSha256 ?? crypto.createHash('sha256').update(fileBytes).digest('hex')
    const existingStock = await prisma.stock.findUnique({ where: { name: stockName } })
    if (existingStock?.sourceSha256 && existingStock.sourceSha256 !== sourceSha256) {
        throw new Error(`Stock ${stockName} already exists with a different source hash`)
    }
    const stock = await prisma.stock.upsert({
        where: { name: stockName },
        update: {
            description: stockDescription ?? existingStock?.description,
            sourcePath: provenance.sourcePath ?? existingStock?.sourcePath,
            sourceSha256,
            schemaVersion: provenance.schemaVersion ?? existingStock?.schemaVersion,
        },
        create: {
            name: stockName,
            description: stockDescription,
            sourcePath: provenance.sourcePath,
            sourceSha256,
            schemaVersion: provenance.schemaVersion,
        },
    })

    // Bulk insert in bounded transactions. This turns the 313k-molecule
    // buyables load from an N+1 query path into a resumable batched operation.
    // Stock rows are narrow, so 1,000-row batches remain well below SQLite's
    // bind-parameter limit while avoiding thousands of tiny transactions.
    const BATCH_SIZE = 1_000
    let moleculesCreated = 0
    let moleculesSkipped = 0
    let itemsCreated = 0

    for (let i = 0; i < moleculeData.length; i += BATCH_SIZE) {
        const batch = moleculeData.slice(i, i + BATCH_SIZE)

        await prisma.$transaction(
            async (tx) => {
                const existingMolecules = await tx.molecule.findMany({
                    where: { inchikey: { in: batch.map((molecule) => molecule.inchikey) } },
                    select: { id: true, inchikey: true, smiles: true },
                })
                const moleculeIds = new Map(existingMolecules.map((molecule) => [molecule.inchikey, molecule.id]))
                const newMolecules = batch.flatMap((molecule) => {
                    if (moleculeIds.has(molecule.inchikey)) return []
                    const id = createId()
                    moleculeIds.set(molecule.inchikey, id)
                    return [{ id, ...molecule }]
                })
                if (newMolecules.length > 0) await tx.molecule.createMany({ data: newMolecules })
                moleculesCreated += newMolecules.length
                moleculesSkipped += batch.length - newMolecules.length

                const ids = batch.map((molecule) => moleculeIds.get(molecule.inchikey)!)
                const existingItems = await tx.stockItem.findMany({
                    where: { stockId: stock.id, moleculeId: { in: ids } },
                    select: { moleculeId: true },
                })
                const existingItemIds = new Set(existingItems.map((item) => item.moleculeId))
                const newItems = batch.flatMap((molecule) => {
                    const moleculeId = moleculeIds.get(molecule.inchikey)!
                    return existingItemIds.has(moleculeId)
                        ? []
                        : [{ id: createId(), stockId: stock.id, moleculeId, smiles: molecule.smiles }]
                })
                if (newItems.length > 0) await tx.stockItem.createMany({ data: newItems })
                itemsCreated += newItems.length
            },
            {
                timeout: 30000, // 30 second timeout for large batches
            }
        )

        // Log progress (skip during tests)
        if (
            process.env.NODE_ENV !== 'test' &&
            (Math.floor(Math.min(i + BATCH_SIZE, moleculeData.length) / 25_000) > Math.floor(i / 25_000) ||
                i + BATCH_SIZE >= moleculeData.length)
        ) {
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

/**
 * Updates commercial metadata for a stock item.
 * Used by load-buyables-metadata script to populate vendor information.
 *
 * @param stockId - The stock ID
 * @param inchikey - The molecule's InChiKey
 * @param metadata - Commercial metadata to update
 * @returns Updated stock item or null if not found
 */
export async function updateStockItemMetadata(
    stockId: string,
    inchikey: string,
    metadata: {
        ppg?: number | null
        source?: VendorSource | null
        leadTime?: string | null
        link?: string | null
    }
): Promise<{ id: string } | null> {
    // Find molecule by inchikey
    const molecule = await prisma.molecule.findUnique({
        where: { inchikey },
        select: { id: true },
    })

    if (!molecule) {
        return null
    }

    // Update stock item if it exists
    try {
        const stockItem = await prisma.stockItem.update({
            where: {
                stockId_moleculeId: {
                    stockId,
                    moleculeId: molecule.id,
                },
            },
            data: {
                ppg: metadata.ppg,
                source: metadata.source,
                leadTime: metadata.leadTime,
                link: metadata.link,
            },
            select: { id: true },
        })
        return stockItem
    } catch {
        // Stock item doesn't exist
        return null
    }
}

/**
 * Batch updates commercial metadata for multiple stock items.
 * Optimized for bulk loading from buyables-meta.json.gz.
 *
 * @param stockId - The stock ID
 * @param updates - Array of updates (inchikey -> metadata)
 * @returns Statistics about the update operation
 */
export async function batchUpdateStockItemMetadata(
    stockId: string,
    updates: Array<{
        inchikey: string
        ppg?: number | null
        source?: VendorSource | null
        leadTime?: string | null
        link?: string | null
    }>
): Promise<{ updated: number; notFound: number }> {
    let updated = 0
    let notFound = 0

    // Process in batches to avoid overwhelming the database
    const BATCH_SIZE = 100

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE)

        await prisma.$transaction(
            async (tx) => {
                // Batch fetch all molecules for this batch (avoid N+1 query problem)
                const inchikeysInBatch = batch.map((u) => u.inchikey)
                const molecules = await tx.molecule.findMany({
                    where: { inchikey: { in: inchikeysInBatch } },
                    select: { id: true, inchikey: true },
                })
                const inchikeyToIdMap = new Map(molecules.map((m) => [m.inchikey, m.id]))

                for (const update of batch) {
                    const moleculeId = inchikeyToIdMap.get(update.inchikey)

                    if (!moleculeId) {
                        notFound++
                        continue
                    }

                    // Update stock item if it exists
                    try {
                        await tx.stockItem.update({
                            where: {
                                stockId_moleculeId: {
                                    stockId,
                                    moleculeId,
                                },
                            },
                            data: {
                                ppg: update.ppg,
                                source: update.source,
                                leadTime: update.leadTime,
                                link: update.link,
                            },
                        })
                        updated++
                    } catch {
                        // Stock item doesn't exist in this stock
                        notFound++
                    }
                }
            },
            {
                timeout: 30000, // 30 second timeout for large batches
            }
        )

        // Log progress (skip during tests)
        if (process.env.NODE_ENV !== 'test') {
            const processed = Math.min(i + BATCH_SIZE, updates.length)
            console.log(`Processed ${processed}/${updates.length} metadata updates...`)
        }
    }

    return { updated, notFound }
}
