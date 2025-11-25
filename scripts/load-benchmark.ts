#!/usr/bin/env tsx

// Load environment variables
/**
 * CLI Script to load retrosynthesis benchmarks from gzipped JSON files into the database.
 *
 * Usage:
 *   tsx scripts/load-benchmark.ts <file-path> <benchmark-name> [description]
 *
 * Examples:
 *   pnpm tsx scripts/load-benchmark.ts /path/to/ref-lng-84.json.gz "ref-lng-84" "84 targets with extra long ground truth routes"
 *   pnpm tsx scripts/load-benchmark.ts /path/to/mkt-lin-500.json.gz "mkt-lin-500" "500 targets from market data with linear routes"
 *
 * File Format:
 *   - Must be a gzipped JSON file (.json.gz)
 *   - JSON structure matches retrocast BenchmarkSet model:
 *     {
 *       "name": "benchmark-name",
 *       "description": "...",
 *       "stock_name": "optional-stock-reference",
 *       "targets": {
 *         "target-id": {
 *           "id": "target-id",
 *           "smiles": "target-smiles",
 *           "metadata": {...},
 *           "ground_truth": { "target": {...}, "rank": 1 },
 *           "is_convergent": boolean,
 *           "route_length": number
 *         }
 *       }
 *     }
 *
 * The script will:
 *   1. Parse the gzipped JSON file
 *   2. Create a new BenchmarkSet in the database
 *   3. For each target:
 *      - Create or reuse Molecule records
 *      - Create BenchmarkTarget record
 *      - Parse and store ground truth route (if present) as RouteNode tree
 *   4. Compute route properties (length, convergence)
 *   5. Report statistics on completion
 */
import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'
import { config } from 'dotenv'

import { createBenchmark } from '../src/lib/services/benchmark.service'
import { loadBenchmarkFromFile } from '../src/lib/services/route.service'

// Load environment variables FIRST before importing anything that uses the database
config({ path: '.env' })

interface BenchmarkMetadata {
    stock_name?: string | null
}

async function main() {
    const args = process.argv.slice(2)

    if (args.length < 2) {
        console.error('Usage: tsx scripts/load-benchmark.ts <file-path> <benchmark-name> [description]')
        console.error('')
        console.error('Examples:')
        console.error(
            '  tsx scripts/load-benchmark.ts ./data/ref-lng-84.json.gz "ref-lng-84" "84 targets with long routes"'
        )
        console.error('  tsx scripts/load-benchmark.ts ./data/mkt-lin-500.json.gz "mkt-lin-500"')
        process.exit(1)
    }

    const [filePath, benchmarkName, description] = args

    // Resolve to absolute path
    const absolutePath = path.resolve(filePath)

    console.log('='.repeat(70))
    console.log('Benchmark Loader')
    console.log('='.repeat(70))
    console.log(`File:             ${absolutePath}`)
    console.log(`Benchmark Name:   ${benchmarkName}`)
    console.log(`Description:      ${description || '(none)'}`)
    console.log('='.repeat(70))
    console.log('')

    const startTime = Date.now()

    try {
        // Parse file metadata to get stock_name
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
            console.warn(
                `Warning: Could not parse stock_name from file: ${error instanceof Error ? error.message : String(error)}`
            )
        }

        // Create benchmark first
        console.log('Creating benchmark...')
        const benchmark = await createBenchmark(benchmarkName, description, stockName)
        console.log(`Created benchmark with ID: ${benchmark.id}`)
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
        console.log(`Ground Truth Routes:  ${result.routesCreated}`)
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
