#!/usr/bin/env tsx

/**
 * CLI Script to load model predictions from retrocast pipeline outputs.
 *
 * Usage:
 *   tsx scripts/load-predictions.ts <benchmark-name> <model-name> --algorithm <algorithm-name> [options]
 *
 * Required Arguments:
 *   <benchmark-name>         Name of benchmark (must exist in database)
 *   <model-name>            Name of model instance to create/use
 *   --algorithm <name>      Algorithm name (e.g., "DirectMultiStep", "Retro*")
 *
 * Options:
 *   --data-dir <path>        Base data directory (default: ../project-procrustes/data)
 *   --stock <stock-name>     Load evaluations for specific stock (optional)
 *   --routes-only            Only load routes, skip evaluations and statistics
 *   --algorithm-paper <url>  Paper URL for algorithm (optional)
 *   --model-version <ver>    Model version string (optional)
 *
 * Examples:
 *   # Load only routes
 *   pnpm tsx scripts/load-predictions.ts mkt-cnv-160 dms-explorer-xl --algorithm DirectMultiStep --routes-only
 *
 *   # Load routes + evaluations + statistics for buyables-stock
 *   pnpm tsx scripts/load-predictions.ts mkt-cnv-160 dms-explorer-xl --algorithm DirectMultiStep --stock buyables-stock
 *
 *   # With version and paper
 *   pnpm tsx scripts/load-predictions.ts mkt-cnv-160 dms-explorer-xl --algorithm DirectMultiStep --model-version "v1.0" --algorithm-paper "https://arxiv.org/abs/2405.13983" --stock-path buyables-stock --stock-db "ASKCOS Buyables Stock"
 *
 * File Structure Expected:
 *   {data-dir}/3-processed/{benchmark}/{model}/routes.json.gz
 *   {data-dir}/4-scored/{benchmark}/{model}/{stock-path}/evaluation.json.gz
 *   {data-dir}/5-results/{benchmark}/{model}/{stock-path}/statistics.json.gz
 *
 * The script will:
 *   1. Create Algorithm and ModelInstance if they don't exist
 *   2. Create or update PredictionRun for benchmark+model combination
 *   3. Load routes from 3-processed (creates Route + RouteNode tree + Molecules)
 *   4. If --stock specified:
 *      - Load evaluations from 4-scored (creates RouteSolvability records)
 *      - Load statistics from 5-results (creates ModelRunStatistics + StratifiedMetricGroup)
 *   5. Update aggregate statistics on PredictionRun
 *   6. Report summary
 */
import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'
import { config } from 'dotenv'

import prisma from '../src/lib/db'
import {
    createModelStatistics,
    createOrUpdatePredictionRun,
    createRouteFromPython,
    createRouteSolvability,
    transformPythonStatistics,
    updatePredictionRunStats,
    type PythonRoute,
} from '../src/lib/services/prediction-writer.service'

// Load environment variables
config({ path: '.env' })

// ============================================================================
// Types for File Formats
// ============================================================================

interface RoutesFile {
    [targetId: string]: PythonRoute[]
}

interface EvaluationFile {
    model_name: string
    benchmark_name: string
    stock_name: string
    has_ground_truth: boolean
    results: {
        [targetId: string]: {
            target_id: string
            routes: Array<{
                rank: number
                is_solved: boolean
                is_gt_match: boolean
            }>
            is_solvable: boolean
            gt_rank: number | null
            route_length: number
            is_convergent: boolean
        }
    }
}

interface ManifestFile {
    schema_version: string
    retrocast_version: string
    created_at: string
    action: string
    parameters: Record<string, unknown>
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parses CLI arguments into structured options.
 */
function parseArgs(args: string[]): {
    benchmarkName: string
    modelName: string
    algorithmName: string
    algorithmPaper: string | null
    modelVersion: string | null
    dataDir: string
    stockPathName: string | null
    stockDbName: string | null
    routesOnly: boolean
} {
    if (args.length < 2) {
        throw new Error('Missing required arguments: <benchmark-name> <model-name>')
    }

    const [benchmarkName, modelName] = args
    let dataDir = path.resolve(__dirname, '../../project-procrustes/data')
    let stockPathName: string | null = null
    let stockDbName: string | null = null
    let routesOnly = false
    let algorithmName: string | null = null
    let algorithmPaper: string | null = null
    let modelVersion: string | null = null

    // Parse options
    for (let i = 2; i < args.length; i++) {
        if (args[i] === '--data-dir' && i + 1 < args.length) {
            dataDir = path.resolve(args[i + 1])
            i++
        } else if (args[i] === '--stock-path' && i + 1 < args.length) {
            stockPathName = args[i + 1]
            i++
        } else if (args[i] === '--stock-db' && i + 1 < args.length) {
            stockDbName = args[i + 1]
            i++
        } else if (args[i] === '--algorithm' && i + 1 < args.length) {
            algorithmName = args[i + 1]
            i++
        } else if (args[i] === '--algorithm-paper' && i + 1 < args.length) {
            algorithmPaper = args[i + 1]
            i++
        } else if (args[i] === '--model-version' && i + 1 < args.length) {
            modelVersion = args[i + 1]
            i++
        } else if (args[i] === '--routes-only') {
            routesOnly = true
        } else {
            throw new Error(`Unknown option: ${args[i]}`)
        }
    }

    if (!algorithmName) {
        throw new Error('Missing required option: --algorithm <algorithm-name>')
    }

    // Validate stock options
    if ((stockPathName && !stockDbName) || (!stockPathName && stockDbName)) {
        throw new Error('Both --stock-path and --stock-db must be specified together')
    }

    return {
        benchmarkName,
        modelName,
        algorithmName,
        algorithmPaper,
        modelVersion,
        dataDir,
        stockPathName,
        stockDbName,
        routesOnly,
    }
}

/**
 * Reads and decompresses a .json.gz file.
 */
async function readGzipJson<T>(filePath: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = []
        fs.createReadStream(filePath)
            .pipe(zlib.createGunzip())
            .on('data', (chunk) => chunks.push(chunk))
            .on('end', () => {
                try {
                    const json = Buffer.concat(chunks).toString('utf-8')
                    resolve(JSON.parse(json))
                } catch (error) {
                    reject(error)
                }
            })
            .on('error', reject)
    })
}

/**
 * Checks if a file exists.
 */
function fileExists(filePath: string): boolean {
    try {
        return fs.statSync(filePath).isFile()
    } catch {
        return false
    }
}

// ============================================================================
// Main Loading Logic
// ============================================================================

async function main() {
    const args = process.argv.slice(2)

    // Show usage if no args
    if (args.length === 0) {
        console.error(
            'Usage: tsx scripts/load-predictions.ts <benchmark-name> <model-name> --algorithm <algorithm-name> [options]'
        )
        console.error('')
        console.error('Required Arguments:')
        console.error('  <benchmark-name>         Name of benchmark (must exist in database)')
        console.error('  <model-name>            Name of model instance to create/use')
        console.error('  --algorithm <name>      Algorithm name (e.g., "DirectMultiStep", "Retro*")')
        console.error('')
        console.error('Options:')
        console.error('  --data-dir <path>        Base data directory (default: ../project-procrustes/data)')
        console.error('  --stock-path <name>      Stock name in file path (e.g., "buyables-stock")')
        console.error('  --stock-db <name>        Stock name in database (e.g., "ASKCOS Buyables Stock")')
        console.error('  --routes-only            Only load routes, skip evaluations and statistics')
        console.error('  --algorithm-paper <url>  Paper URL for algorithm (optional)')
        console.error('  --model-version <ver>    Model version string (optional)')
        console.error('')
        console.error('Examples:')
        console.error(
            '  pnpm tsx scripts/load-predictions.ts mkt-cnv-160 dms-explorer-xl --algorithm DirectMultiStep --routes-only'
        )
        console.error(
            '  pnpm tsx scripts/load-predictions.ts mkt-cnv-160 dms-explorer-xl --algorithm DirectMultiStep --stock-path buyables-stock --stock-db "ASKCOS Buyables Stock"'
        )
        process.exit(1)
    }

    let options
    try {
        options = parseArgs(args)
    } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
        process.exit(1)
    }

    const {
        benchmarkName,
        modelName,
        algorithmName,
        algorithmPaper,
        modelVersion,
        dataDir,
        stockPathName,
        stockDbName,
        routesOnly,
    } = options

    console.log('='.repeat(70))
    console.log('Model Predictions Loader')
    console.log('='.repeat(70))
    console.log(`Benchmark:        ${benchmarkName}`)
    console.log(`Algorithm:        ${algorithmName}`)
    console.log(`Model:            ${modelName}`)
    console.log(`Model Version:    ${modelVersion ?? '(none)'}`)
    console.log(`Data Directory:   ${dataDir}`)
    console.log(`Stock (path):     ${stockPathName ?? '(none - routes only)'}`)
    console.log(`Stock (DB):       ${stockDbName ?? '(none - routes only)'}`)
    console.log(`Mode:             ${routesOnly ? 'Routes Only' : 'Full Load'}`)
    console.log('='.repeat(70))
    console.log('')

    const startTime = Date.now()

    try {
        // ====================================================================
        // Step 1: Verify benchmark exists, create algorithm and model if needed
        // ====================================================================
        console.log('Verifying benchmark in database...')

        const benchmark = await prisma.benchmarkSet.findFirst({
            where: { name: benchmarkName },
            select: { id: true, name: true },
        })
        if (!benchmark) {
            throw new Error(
                `Benchmark not found in database: ${benchmarkName}. Please load the benchmark first using load-benchmark.ts`
            )
        }

        console.log(`  Benchmark ID: ${benchmark.id}`)
        console.log('')

        console.log('Creating/finding algorithm...')
        const algorithm = await prisma.algorithm.upsert({
            where: { name: algorithmName },
            update: {},
            create: {
                name: algorithmName,
                paper: algorithmPaper,
            },
            select: { id: true, name: true },
        })
        console.log(`  Algorithm ID: ${algorithm.id} (${algorithm.name})`)
        console.log('')

        console.log('Creating/finding model instance...')
        const model = await prisma.modelInstance.upsert({
            where: { name: modelName },
            update: {
                version: modelVersion ?? undefined,
            },
            create: {
                algorithmId: algorithm.id,
                name: modelName,
                version: modelVersion,
            },
            select: { id: true, name: true },
        })
        console.log(`  Model ID:     ${model.id} (${model.name})`)
        console.log('')

        // ====================================================================
        // Step 2: Resolve file paths and check existence
        // ====================================================================
        const routesFile = path.join(dataDir, '3-processed', benchmarkName, modelName, 'routes.json.gz')
        const manifestFile = path.join(dataDir, '3-processed', benchmarkName, modelName, 'manifest.json')

        console.log('Checking files...')
        console.log(`  Routes file: ${routesFile}`)

        if (!fileExists(routesFile)) {
            throw new Error(`Routes file not found: ${routesFile}`)
        }

        let manifest: ManifestFile | null = null
        if (fileExists(manifestFile)) {
            manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'))
            console.log(`  Manifest:    Found (retrocast ${manifest.retrocast_version})`)
        } else {
            console.log(`  Manifest:    Not found (will use defaults)`)
        }

        // Check evaluation and statistics files if stock specified
        let evaluationFile: string | null = null
        let statisticsFile: string | null = null

        if (stockPathName && !routesOnly) {
            evaluationFile = path.join(
                dataDir,
                '4-scored',
                benchmarkName,
                modelName,
                stockPathName,
                'evaluation.json.gz'
            )
            statisticsFile = path.join(
                dataDir,
                '5-results',
                benchmarkName,
                modelName,
                stockPathName,
                'statistics.json.gz'
            )

            console.log(`  Evaluation:  ${evaluationFile}`)
            console.log(`  Statistics:  ${statisticsFile}`)

            if (!fileExists(evaluationFile)) {
                throw new Error(`Evaluation file not found: ${evaluationFile}`)
            }
            if (!fileExists(statisticsFile)) {
                throw new Error(`Statistics file not found: ${statisticsFile}`)
            }
        }

        console.log('')

        // ====================================================================
        // Step 3: Create or update PredictionRun
        // ====================================================================
        console.log('Creating/updating prediction run...')

        const predictionRun = await createOrUpdatePredictionRun(benchmark.id, model.id, {
            retrocastVersion: manifest?.retrocast_version ?? undefined,
            executedAt: manifest?.created_at ? new Date(manifest.created_at) : new Date(),
        })

        console.log(`  Prediction Run ID: ${predictionRun.id}`)
        console.log('')

        // ====================================================================
        // Step 4: Load routes from 3-processed
        // ====================================================================
        console.log('Loading routes from file...')
        const routesData = await readGzipJson<RoutesFile>(routesFile)

        const targetIds = Object.keys(routesData)
        console.log(`  Found ${targetIds.length} targets`)

        let routesCreated = 0
        let targetsFailed = 0

        for (let i = 0; i < targetIds.length; i++) {
            const externalTargetId = targetIds[i]
            const routes = routesData[externalTargetId]

            // Show progress every 10 targets
            if (i % 10 === 0) {
                console.log(`  Processing target ${i + 1}/${targetIds.length}: ${externalTargetId}`)
            }

            try {
                // Find BenchmarkTarget by targetId (the external ID from Python)
                const target = await prisma.benchmarkTarget.findFirst({
                    where: {
                        benchmarkSetId: benchmark.id,
                        targetId: externalTargetId,
                    },
                    select: { id: true },
                })

                if (!target) {
                    console.warn(`  Warning: Target not found in database: ${externalTargetId} (skipping)`)
                    targetsFailed++
                    continue
                }

                // Create each route for this target
                for (const pythonRoute of routes) {
                    await createRouteFromPython(pythonRoute, predictionRun.id, target.id)
                    routesCreated++
                }
            } catch (error) {
                console.error(
                    `  Error processing target ${externalTargetId}: ${error instanceof Error ? error.message : String(error)}`
                )
                targetsFailed++
            }
        }

        console.log(`  Routes created: ${routesCreated}`)
        if (targetsFailed > 0) {
            console.log(`  Targets failed: ${targetsFailed}`)
        }
        console.log('')

        // ====================================================================
        // Step 5: Load evaluations (if stock specified)
        // ====================================================================
        if (stockPathName && stockDbName && !routesOnly && evaluationFile) {
            console.log(`Loading evaluations for stock: ${stockDbName}...`)

            // Find stock in database by exact name
            const stock = await prisma.stock.findFirst({
                where: { name: stockDbName },
                select: { id: true, name: true },
            })

            if (!stock) {
                // Show available stocks to help user
                const availableStocks = await prisma.stock.findMany({
                    select: { name: true },
                })
                const stockNames = availableStocks.map((s) => s.name).join(', ')
                throw new Error(`Stock not found in database: ${stockDbName}. Available stocks: ${stockNames}`)
            }

            console.log(`  Stock ID: ${stock.id}`)

            const evaluationData = await readGzipJson<EvaluationFile>(evaluationFile)
            const evalTargetIds = Object.keys(evaluationData.results)

            console.log(`  Found evaluations for ${evalTargetIds.length} targets`)

            let solvabilityRecordsCreated = 0

            for (let i = 0; i < evalTargetIds.length; i++) {
                const externalTargetId = evalTargetIds[i]
                const targetEval = evaluationData.results[externalTargetId]

                if (i % 10 === 0) {
                    console.log(`  Processing evaluation ${i + 1}/${evalTargetIds.length}: ${externalTargetId}`)
                }

                try {
                    // Find target by targetId (the external ID from Python)
                    const target = await prisma.benchmarkTarget.findFirst({
                        where: {
                            benchmarkSetId: benchmark.id,
                            targetId: externalTargetId,
                        },
                        select: { id: true },
                    })

                    if (!target) {
                        console.warn(`  Warning: Target not found: ${externalTargetId} (skipping)`)
                        continue
                    }

                    // Find routes for this target in this prediction run
                    const routes = await prisma.route.findMany({
                        where: {
                            targetId: target.id,
                            predictionRunId: predictionRun.id,
                        },
                        select: { id: true, rank: true },
                        orderBy: { rank: 'asc' },
                    })

                    // Match routes by rank and create solvability records
                    for (const routeEval of targetEval.routes) {
                        const route = routes.find((r) => r.rank === routeEval.rank)
                        if (!route) {
                            console.warn(
                                `  Warning: Route rank ${routeEval.rank} not found for target ${externalTargetId} (skipping)`
                            )
                            continue
                        }

                        await createRouteSolvability(route.id, stock.id, routeEval.is_solved, routeEval.is_gt_match)
                        solvabilityRecordsCreated++
                    }
                } catch (error) {
                    console.error(
                        `  Error processing evaluation for ${externalTargetId}: ${error instanceof Error ? error.message : String(error)}`
                    )
                }
            }

            console.log(`  Solvability records created: ${solvabilityRecordsCreated}`)
            console.log('')

            // ================================================================
            // Step 6: Load statistics (if stock specified)
            // ================================================================
            console.log('Loading statistics...')

            // Read raw Python JSON (with snake_case keys)
            const rawStatisticsData = await readGzipJson<any>(statisticsFile!)

            // Transform snake_case to camelCase
            const statisticsData = transformPythonStatistics(rawStatisticsData)

            await createModelStatistics(predictionRun.id, benchmark.id, stock.id, statisticsData)

            console.log(`  Statistics loaded successfully`)
            console.log('')
        }

        // ====================================================================
        // Step 7: Update aggregate stats on PredictionRun
        // ====================================================================
        console.log('Updating prediction run aggregate statistics...')
        const runStats = await updatePredictionRunStats(predictionRun.id)
        console.log(`  Total routes:      ${runStats.totalRoutes}`)
        console.log(`  Avg route length:  ${runStats.avgRouteLength.toFixed(2)}`)
        console.log('')

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

        console.log('='.repeat(70))
        console.log('Load Complete!')
        console.log('='.repeat(70))
        console.log(`Prediction Run ID:    ${predictionRun.id}`)
        console.log(`Benchmark:            ${benchmarkName}`)
        console.log(`Model:                ${modelName}`)
        console.log(`Routes Created:       ${routesCreated}`)
        if (stockPathName && stockDbName && !routesOnly) {
            console.log(`Stock (path):         ${stockPathName}`)
            console.log(`Stock (DB):           ${stockDbName}`)
            console.log(`Evaluations Loaded:   Yes`)
            console.log(`Statistics Loaded:    Yes`)
        } else {
            console.log(`Evaluations Loaded:   No`)
            console.log(`Statistics Loaded:    No`)
        }
        console.log(`Time Elapsed:         ${elapsed}s`)
        console.log('='.repeat(70))

        process.exit(0)
    } catch (error) {
        console.error('')
        console.error('='.repeat(70))
        console.error('Error!')
        console.error('='.repeat(70))
        console.error(error instanceof Error ? error.message : String(error))
        if (error instanceof Error && error.stack) {
            console.error('')
            console.error('Stack trace:')
            console.error(error.stack)
        }
        console.error('='.repeat(70))
        process.exit(1)
    }
}

main()
