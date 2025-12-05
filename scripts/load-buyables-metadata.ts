#!/usr/bin/env tsx

/**
 * CLI Script to load buyables metadata from a JSON.GZ file into the database.
 *
 * Usage:
 *   tsx scripts/load-buyables-metadata.ts <file-path> <stock-name>
 *
 * Example:
 *   pnpm tsx scripts/load-buyables-metadata.ts data/1-benchmarks/stocks/buyables-meta.json.gz "ASKCOS Buyables Stock"
 *
 * File Format (JSON array in gzipped format):
 *   Array of objects with fields:
 *   [
 *     {
 *       "smiles": "...",
 *       "inchikey": "...",
 *       "ppg": 12.50,           // Price per gram in USD (optional)
 *       "source": "MC",         // Vendor source: MC, LN, EM, SA, CB (optional)
 *       "lead_time": "7-21days", // Lead time string (optional)
 *       "link": "https://..."   // Product URL (optional)
 *     }
 *   ]
 *
 * The script is idempotent - running it multiple times will update existing metadata.
 */
import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'

import './env-loader'

import { batchUpdateStockItemMetadata, getStockByName } from '../src/lib/services/stock.service'
import type { VendorSource } from '../src/types'

// Vendor source mapping from Python enum values
const VENDOR_SOURCE_MAP: Record<string, VendorSource> = {
    MC: 'MC',
    LN: 'LN',
    EM: 'EM',
    SA: 'SA',
    CB: 'CB',
}

interface BuyableMolecule {
    smiles: string
    inchikey: string
    ppg?: number | null
    source?: string | null
    lead_time?: string | null
    link?: string | null
}

async function main() {
    const args = process.argv.slice(2)

    if (args.length < 2) {
        console.error('Usage: tsx scripts/load-buyables-metadata.ts <file-path> <stock-name>')
        console.error('')
        console.error('Example:')
        console.error(
            '  tsx scripts/load-buyables-metadata.ts data/1-benchmarks/stocks/buyables-meta.json.gz "ASKCOS Buyables Stock"'
        )
        process.exit(1)
    }

    const [filePath, stockName] = args

    // Resolve to absolute path
    const absolutePath = path.resolve(filePath)

    console.log('='.repeat(70))
    console.log('Buyables Metadata Loader')
    console.log('='.repeat(70))
    console.log(`File:        ${absolutePath}`)
    console.log(`Stock Name:  ${stockName}`)
    console.log('='.repeat(70))
    console.log('')

    const startTime = Date.now()

    try {
        // Validate file exists
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`File not found: ${absolutePath}`)
        }

        // Find stock by name
        const stock = await getStockByName(stockName)
        if (!stock) {
            throw new Error(`Stock not found: ${stockName}`)
        }

        console.log(`Found stock: ${stock.name} (ID: ${stock.id})`)
        console.log(`Stock contains ${stock.itemCount.toLocaleString()} molecules`)
        console.log('')
        console.log('Reading and decompressing metadata file...')

        // Read and decompress the entire file
        const compressedData = fs.readFileSync(absolutePath)
        const decompressedData = zlib.gunzipSync(compressedData)
        const jsonString = decompressedData.toString('utf-8')

        console.log('Parsing JSON array...')
        const buyables: BuyableMolecule[] = JSON.parse(jsonString)

        console.log(`Parsed ${buyables.length.toLocaleString()} buyable molecules`)
        console.log('')
        console.log('Processing metadata...')

        // Process buyables and convert to updates
        const updates: Array<{
            inchikey: string
            ppg?: number | null
            source?: VendorSource | null
            leadTime?: string | null
            link?: string | null
        }> = []

        let validCount = 0
        let skippedCount = 0

        for (const data of buyables) {
            if (!data.inchikey) {
                skippedCount++
                continue
            }

            // Map vendor source to our enum
            const source = data.source && VENDOR_SOURCE_MAP[data.source] ? VENDOR_SOURCE_MAP[data.source] : null

            updates.push({
                inchikey: data.inchikey,
                ppg: data.ppg ?? null,
                source: source,
                leadTime: data.lead_time ?? null,
                link: data.link ?? null,
            })
            validCount++
        }

        console.log(`Valid entries: ${validCount.toLocaleString()}`)
        console.log(`Skipped entries: ${skippedCount.toLocaleString()}`)
        console.log('')
        console.log('Updating database...')

        // Batch update stock items
        const result = await batchUpdateStockItemMetadata(stock.id, updates)

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

        console.log('')
        console.log('='.repeat(70))
        console.log('Load Complete!')
        console.log('='.repeat(70))
        console.log(`Stock ID:           ${stock.id}`)
        console.log(`Metadata Updated:   ${result.updated.toLocaleString()}`)
        console.log(`Not Found in Stock: ${result.notFound.toLocaleString()}`)
        console.log(`Time Elapsed:       ${elapsed}s`)
        console.log('='.repeat(70))

        process.exit(0)
    } catch (error) {
        console.error('')
        console.error('='.repeat(70))
        console.error('Error!')
        console.error('='.repeat(70))
        console.error(error instanceof Error ? error.message : String(error))
        console.error('='.repeat(70))
        process.exit(1)
    }
}

main()
