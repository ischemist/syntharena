#!/usr/bin/env tsx

// Load environment variables
/**
 * CLI Script to load retrosynthesis benchmarks from gzipped JSON files into the database.
 *
 * Usage:
 *   tsx scripts/load-benchmark.ts <file-path> <benchmark-name> [description] [--stock <stock-db-name>]
 *
 * Arguments:
 *   <file-path>          Path to the benchmark .json.gz file
 *   <benchmark-name>     Name for the benchmark in the database
 *   [description]        Optional description
 *   --stock <name>       Override stock name (use database stock name, not file stock_name)
 *
 * Examples:
 *   pnpm tsx scripts/load-benchmark.ts /Users/morgunov/Developer/ischemist/project-procrustes/data/1-benchmarks/definitions/re-export/ref-lng-84.json.gz "ref-lng-84" "84 targets with extra long ground truth routes" --stock "n1+n5 Stock"
 *   pnpm tsx scripts/load-benchmark.ts /Users/morgunov/Developer/ischemist/project-procrustes/data/1-benchmarks/definitions/re-export/uspto-190.json.gz "uspto-190" "190 targets from the test set of the original Retro*" --stock "ASKCOS Buyables Stock"
 *   pnpm tsx scripts/load-benchmark.ts /Users/morgunov/Developer/ischemist/project-procrustes/data/1-benchmarks/definitions/re-export/mkt-cnv-160.json.gz "mkt-cnv-160" "160 targets with convergent ground truth routes of variable length with all leaves in buyables. Part of the Procrustes suite." --stock "ASKCOS Buyables Stock"
 *
 * File Format:
 *   - Must be a gzipped JSON file (.json.gz)
 *   - JSON structure matches retrocast BenchmarkSet model:
 *     {
 *       "name": "benchmark-name",
 *       "description": "...",
 *       "stock_name": "stock-reference",  // REQUIRED (or use --stock to override)
 *       "targets": {
 *         "target-id": {
 *           "id": "target-id",
 *           "smiles": "target-smiles",
 *           "inchi_key": "...",
 *           "acceptable_routes": [...],
 *           "metadata": {...}
 *         }
 *       }
 *     }
 *
 * Notes:
 *   - acceptable_routes is an array (can be empty for pure prediction tasks)
 *   - First route in array (index 0) is the PRIMARY route used for stratification
 *   - route_length and is_convergent are computed from primary route automatically
 *
 * The script will:
 *   1. Parse the gzipped JSON file and extract stock_name
 *   2. Resolve stock_name to stockId in database (or use --stock override)
 *   3. Create a new BenchmarkSet with stockId reference
 *   4. For each target:
 *      - Create or reuse Molecule records
 *      - Create BenchmarkTarget record
 *      - Parse and store acceptable routes (if present) as RouteNode tree with junction records
 *   5. Compute route properties (length, convergence) from primary route (index 0)
 *   6. Report statistics on completion
 */
import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'

import './env-loader'

import { createBenchmark } from '../src/lib/services/benchmark.service'
import { loadBenchmarkFromFile } from '../src/lib/services/loaders/benchmark-loader.service'
import { getStockByName } from '../src/lib/services/loaders/stock-loader.service'

interface BenchmarkMetadata {
    stock_name?: string | null
}

async function main() {
    const args = process.argv.slice(2)

    if (args.length < 2) {
        console.error(
            'Usage: tsx scripts/load-benchmark.ts <file-path> <benchmark-name> [description] [--stock <stock-db-name>]'
        )
        console.error('')
        console.error('Arguments:')
        console.error('  <file-path>          Path to the benchmark .json.gz file')
        console.error('  <benchmark-name>     Name for the benchmark in the database')
        console.error('  [description]        Optional description')
        console.error('  --stock <name>       Override stock name (use database stock name, not file stock_name)')
        console.error('')
        console.error('Examples:')
        console.error(
            '  tsx scripts/load-benchmark.ts ./data/ref-lng-84.json.gz "ref-lng-84" "84 targets with long routes"'
        )
        console.error(
            '  tsx scripts/load-benchmark.ts ./data/mkt-cnv-160.json.gz "mkt-cnv-160" --stock "ASKCOS Buyables Stock"'
        )
        console.error('  tsx scripts/load-benchmark.ts ./data/mkt-lin-500.json.gz "mkt-lin-500"')
        process.exit(1)
    }

    // Parse arguments
    let stockDbNameOverride: string | undefined

    // First two non-flag args are filePath and benchmarkName
    const nonFlagArgs: string[] = []
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--stock' && i + 1 < args.length) {
            stockDbNameOverride = args[i + 1]
            i++ // Skip next arg
        } else if (!args[i].startsWith('--')) {
            nonFlagArgs.push(args[i])
        }
    }

    const filePath = nonFlagArgs[0]
    const benchmarkName = nonFlagArgs[1]
    const description = nonFlagArgs[2] // Optional

    // Resolve to absolute path
    const absolutePath = path.resolve(filePath)

    console.log('='.repeat(70))
    console.log('Benchmark Loader')
    console.log('='.repeat(70))
    console.log(`File:             ${absolutePath}`)
    console.log(`Benchmark Name:   ${benchmarkName}`)
    console.log(`Description:      ${description || '(none)'}`)
    console.log(`Stock Override:   ${stockDbNameOverride || '(none - will use file stock_name)'}`)
    console.log('='.repeat(70))
    console.log('')

    const startTime = Date.now()

    try {
        // Phase 9: Parse stock_name from file and resolve to stockId
        console.log('Parsing file metadata...')
        let stockName: string | undefined

        try {
            const metadata = await new Promise<BenchmarkMetadata>((resolve, reject) => {
                const chunks: Buffer[] = []
                fs.createReadStream(absolutePath)
                    .pipe(zlib.createGunzip())
                    .on('data', (chunk) => {
                        chunks.push(chunk)
                    })
                    .on('end', () => {
                        try {
                            const json = Buffer.concat(chunks).toString('utf-8')
                            const data = JSON.parse(json) as BenchmarkMetadata
                            resolve(data)
                        } catch (error) {
                            reject(error)
                        }
                    })
                    .on('error', (error) => {
                        reject(error)
                    })
            })
            stockName = metadata.stock_name ?? undefined
        } catch (error) {
            console.error(`Error parsing file metadata: ${error instanceof Error ? error.message : String(error)}`)
            throw new Error('Failed to parse benchmark file. Please ensure it is a valid gzipped JSON file.')
        }

        // Resolve stock_name to stockId (REQUIRED)
        // Priority: --stock flag > file stock_name
        const stockNameToResolve = stockDbNameOverride || stockName

        if (!stockNameToResolve) {
            throw new Error(
                'Stock reference is required. Either:\n' +
                    '  1. Ensure the benchmark file contains stock_name field, OR\n' +
                    '  2. Use --stock <stock-db-name> to specify the stock'
            )
        }

        console.log(
            `Resolving stock "${stockNameToResolve}"${stockDbNameOverride ? ' (from --stock flag)' : ' (from file)'}...`
        )
        const stock = await getStockByName(stockNameToResolve)
        if (!stock) {
            throw new Error(
                `Stock "${stockNameToResolve}" not found in database. ` +
                    `Please load the stock first using: pnpm tsx scripts/load-stock.ts <csv-file> "${stockNameToResolve}"`
            )
        }
        const stockId = stock.id
        console.log(`✓ Resolved stock "${stock.name}" to ID: ${stockId}`)
        console.log('')

        // Create benchmark with resolved stockId
        console.log('Creating benchmark...')
        const benchmark = await createBenchmark(benchmarkName, description, stockId)
        console.log(`Created benchmark with ID: ${benchmark.id}`)
        console.log(`Stock: ${benchmark.stock?.name} (${benchmark.stockId})`)
        console.log('')

        // Load targets and routes
        const result = await loadBenchmarkFromFile(absolutePath, benchmark.id, benchmarkName)

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

        console.log('')
        console.log('='.repeat(70))
        console.log('Load Complete!')
        console.log('='.repeat(70))
        console.log(`Benchmark ID:         ${result.benchmarkId}`)
        console.log(`Benchmark Name:       ${result.benchmarkName}`)
        console.log(`Targets Loaded:       ${result.targetsLoaded}`)
        console.log(`Molecules Created:    ${result.moleculesCreated}`)
        console.log(`Molecules Reused:     ${result.moleculesReused}`)
        console.log(`Acceptable Routes:    ${result.routesCreated}`)
        console.log(`Time Elapsed:         ${elapsed}s`)
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
