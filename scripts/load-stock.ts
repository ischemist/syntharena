#!/usr/bin/env tsx

/**
 * CLI Script to load stock molecules from a CSV file into the database.
 *
 * Usage:
 *   tsx scripts/load-stock.ts <file-path> <stock-name> [description]
 *
 * Example:
 * pnpm tsx scripts/load-stock.ts /Users/morgunov/Developer/ischemist/project-procrustes/data/1-benchmarks/stocks/export/n5-stock-export.txt "n5 Stock" "A set of all leaves from routes in PaRoutes n5 evaluation set"
 * pnpm tsx scripts/load-stock.ts /Users/morgunov/Developer/ischemist/project-procrustes/data/1-benchmarks/stocks/export/n1-stock-export.txt "n1 Stock" "A set of all leaves from routes in PaRoutes n1 evaluation set"
 * pnpm tsx scripts/load-stock.ts /Users/morgunov/Developer/ischemist/project-procrustes/data/1-benchmarks/stocks/export/buyables-stock-export.txt "Buyables Stock" "Buyables Stock (from ASKCOS)"
 *
 * File Format:
 *   - First line must be header: "SMILES,InChi Key"
 *   - Subsequent lines: <smiles>,<inchikey>
 *
 * The script is idempotent - running it multiple times with the same stock name will fail,
 * but if you load the same molecules into different stocks, they won't be duplicated.
 */
import * as path from 'path'

import { loadStockFromFile } from '../src/lib/services/stock.service'

async function main() {
    const args = process.argv.slice(2)

    if (args.length < 2) {
        console.error('Usage: tsx scripts/load-stock.ts <file-path> <stock-name> [description]')
        console.error('')
        console.error('Example:')
        console.error('  tsx scripts/load-stock.ts ./data/n5-stock.txt "N5 Stock" "N5 commercial molecules"')
        process.exit(1)
    }

    const [filePath, stockName, description] = args

    // Resolve to absolute path
    const absolutePath = path.resolve(filePath)

    console.log('='.repeat(70))
    console.log('Stock Loader')
    console.log('='.repeat(70))
    console.log(`File:        ${absolutePath}`)
    console.log(`Stock Name:  ${stockName}`)
    console.log(`Description: ${description || '(none)'}`)
    console.log('='.repeat(70))
    console.log('')

    const startTime = Date.now()

    try {
        const result = await loadStockFromFile(absolutePath, stockName, description)

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

        console.log('')
        console.log('='.repeat(70))
        console.log('Load Complete!')
        console.log('='.repeat(70))
        console.log(`Stock ID:           ${result.stockId}`)
        console.log(`Molecules Created:  ${result.moleculesCreated}`)
        console.log(`Molecules Skipped:  ${result.moleculesSkipped} (already existed)`)
        console.log(`Stock Items Created: ${result.itemsCreated}`)
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
