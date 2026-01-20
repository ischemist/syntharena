#!/usr/bin/env tsx

/**
 * CLI Script to load model predictions from retrocast pipeline outputs.
 *
 * This script populates the database based on the three-tier hierarchy:
 * Algorithm -> ModelFamily -> ModelInstance
 *
 * Usage:
 *   tsx scripts/load-predictions.ts [options] <benchmark-name> <model-path-name>
 *
 * Positional Arguments:
 *   <benchmark-name>         Name of the benchmark directory (e.g., "mkt-cnv-160")
 *   <model-path-name>        Name of the model directory (e.g., "dms-explorer-xl")
 *
 * Algorithm (one required):
 *   --algorithm <name>         Algorithm name (creates/finds by name)
 *   --algorithm-slug <slug>    Required when creating a new algorithm
 *   --algorithm-id <id>        OR: Use existing algorithm by ID
 *
 * Model Family (one required):
 *   --model-family-name <name> Model family name (e.g., "DMS Explorer XL")
 *   --model-family-slug <slug> Required when creating a new model family
 *   --model-family-id <id>     OR: Use existing model family by ID
 *
 * Model Instance (required):
 *   --model-slug <slug>        URL-safe slug for the instance (e.g., "dms-explorer-xl-v1-2-0")
 *   --version-major <n>        Major version (default: 0)
 *   --version-minor <n>        Minor version (default: 0)
 *   --version-patch <n>        Patch version (default: 0)
 *   --version-prerelease <s>   Prerelease tag (e.g., "alpha", "beta.1")
 *   --model-description <s>    Optional description for this instance
 *
 * Stock (for evaluations):
 *   --stock-path <name>        Stock name in file path (e.g., "buyables-stock")
 *   --stock-db <name>          Stock name in database
 *
 * Other Options:
 *   --data-dir <path>          Base data directory (default: ../project-procrustes/data/retrocast)
 *   --routes-only              Only load routes, skip evaluations and statistics
 *   --hourly-cost <usd>        Compute cost in USD per hour
 *
 * Example:
 *   pnpm tsx scripts/load-predictions.ts mkt-cnv-160 dms-explorer-xl \
 *     --algorithm "DirectMultiStep" --algorithm-slug "direct-multi-step" \
 *     --model-family-name "DMS Explorer XL" --model-family-slug "dms-explorer-xl" \
 *     --model-slug "dms-explorer-xl-v1-1-3" \
 *     --version-major 1 --version-minor 1 --version-patch 3 \
 *     --stock-path "buyables-stock" --stock-db "ASKCOS Buyables Stock"
 *
 * The script will:
 *   1. Resolve or create Algorithm, ModelFamily, and ModelInstance.
 *   2. Create or update PredictionRun for benchmark+instance combination.
 *   3. Load routes from 3-processed.
 *   4. If --stock specified, load evaluations from 4-scored and statistics from 5-results.
 *   5. Update aggregate statistics on PredictionRun and report summary.
 */
import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'

import './env-loader'

import prisma from '../src/lib/db'
import {
    createModelStatistics,
    createOrUpdatePredictionRun,
    createRouteFromPython,
    createRouteSolvability,
    transformPythonStatistics,
    updatePredictionRunCost,
    updatePredictionRunStats,
    type PythonModelStatistics,
    type PythonRoute,
} from '../src/lib/services/loaders/prediction-loader.service'

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
    has_acceptable_routes: boolean
    results: {
        [targetId: string]: {
            target_id: string
            routes: Array<{
                rank: number
                is_solved: boolean
                matches_acceptable: boolean
                matched_acceptable_index: number | null
            }>
            is_solvable: boolean
            acceptable_rank: number | null
            // Stratification fields (renamed in Python TargetEvaluation)
            stratification_length: number | null
            stratification_is_convergent: boolean | null
            // Runtime metrics (in seconds)
            wall_time: number | null
            cpu_time: number | null
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

/** Parsed CLI options */
interface ParsedOptions {
    benchmarkName: string
    modelPathName: string

    algorithmName: string | null
    algorithmId: string | null
    algorithmSlug: string | null

    modelFamilyName: string | null
    modelFamilyId: string | null
    modelFamilySlug: string | null

    modelSlug: string | null
    modelDescription: string | null
    versionMajor: number
    versionMinor: number
    versionPatch: number
    versionPrerelease: string | null

    stockPathName: string | null
    stockDbName: string | null

    dataDir: string
    routesOnly: boolean
    hourlyCost: number | null
}

/**
 * Parses CLI arguments into structured options.
 */
function parseArgs(args: string[]): ParsedOptions {
    const positionalArgs = args.filter((arg) => !arg.startsWith('--'))
    if (positionalArgs.length < 2) {
        throw new Error('missing required positional arguments: <benchmark-name> and <model-path-name>')
    }
    const [benchmarkName, modelPathName] = positionalArgs

    const argMap = new Map<string, string | true>()
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            const key = args[i]
            if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
                argMap.set(key, args[i + 1])
                i++
            } else {
                argMap.set(key, true)
            }
        }
    }

    const getString = (key: string) => (argMap.get(key) === true ? null : (argMap.get(key) as string | null)) ?? null
    const getInt = (key: string, def: number) => {
        const val = parseInt(getString(key) ?? '', 10)
        return isNaN(val) ? def : val
    }

    const options = {
        benchmarkName,
        modelPathName,
        algorithmName: getString('--algorithm'),
        algorithmId: getString('--algorithm-id'),
        algorithmSlug: getString('--algorithm-slug'),
        modelFamilyName: getString('--model-family-name'),
        modelFamilyId: getString('--model-family-id'),
        modelFamilySlug: getString('--model-family-slug'),
        modelSlug: getString('--model-slug'),
        modelDescription: getString('--model-description'),
        versionMajor: getInt('--version-major', 0),
        versionMinor: getInt('--version-minor', 0),
        versionPatch: getInt('--version-patch', 0),
        versionPrerelease: getString('--version-prerelease'),
        stockPathName: getString('--stock-path'),
        stockDbName: getString('--stock-db'),
        dataDir: getString('--data-dir') ?? path.resolve(__dirname, '../../project-procrustes/data/retrocast'),
        routesOnly: argMap.has('--routes-only'),
        hourlyCost: parseFloat(getString('--hourly-cost') ?? ''),
    }

    // --- Validation ---
    if (!options.algorithmName && !options.algorithmId) throw new Error('must specify --algorithm or --algorithm-id')
    if (options.algorithmName && !options.algorithmSlug)
        throw new Error('--algorithm-slug is required with --algorithm')
    if (!options.modelFamilyName && !options.modelFamilyId)
        throw new Error('must specify --model-family-name or --model-family-id')
    if (options.modelFamilyName && !options.modelFamilySlug)
        throw new Error('--model-family-slug is required with --model-family-name')
    if (!options.modelSlug) throw new Error('--model-slug is required')
    if (options.stockPathName && !options.stockDbName) throw new Error('--stock-db is required with --stock-path')

    return {
        ...options,
        hourlyCost: isNaN(options.hourlyCost) ? null : options.hourlyCost,
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
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        console.log(
            fs
                .readFileSync(path.join(__dirname, 'load-predictions.ts'), 'utf-8')
                .match(/\/\*\*\s*\n([\s\S]*?)\*\//)?.[1] ?? 'no help found.'
        )
        process.exit(0)
    }

    let options: ParsedOptions
    try {
        options = parseArgs(args)
    } catch (error) {
        console.error(`error: ${error instanceof Error ? error.message : String(error)}`)
        process.exit(1)
    }

    const {
        benchmarkName,
        modelPathName,
        algorithmName,
        algorithmId,
        algorithmSlug,
        modelFamilyName,
        modelFamilyId,
        modelFamilySlug,
        modelSlug,
        modelDescription,
        versionMajor,
        versionMinor,
        versionPatch,
        versionPrerelease,
        dataDir,
        stockPathName,
        stockDbName,
        routesOnly,
        hourlyCost,
    } = options

    const versionString = `v${versionMajor}.${versionMinor}.${versionPatch}${versionPrerelease ? `-${versionPrerelease}` : ''}`

    console.log('='.repeat(70))
    console.log('Model Predictions Loader')
    console.log('='.repeat(70))
    console.log(`Benchmark:        ${benchmarkName}`)
    console.log(`Model Path:       ${modelPathName}`)
    console.log(`Algorithm:        ${algorithmName ?? `(ID: ${algorithmId})`}`)
    console.log(`Model Family:     ${modelFamilyName ?? `(ID: ${modelFamilyId})`}`)
    console.log(`Model Instance:   ${modelSlug} (${versionString})`)
    console.log('='.repeat(70))
    console.log('')

    const startTime = Date.now()

    try {
        // --- Step 1: Resolve all entities ---
        console.log('resolving entities...')
        const benchmark = await prisma.benchmarkSet.findUnique({
            where: { name: benchmarkName },
            select: { id: true, name: true },
        })
        if (!benchmark) throw new Error(`benchmark not found: ${benchmarkName}`)

        let algorithm: { id: string; name: string }
        if (algorithmId) {
            const found = await prisma.algorithm.findUnique({
                where: { id: algorithmId },
                select: { id: true, name: true },
            })
            if (!found) throw new Error(`algorithm not found with ID: ${algorithmId}`)
            algorithm = found
        } else {
            algorithm = await prisma.algorithm.upsert({
                where: { name: algorithmName! },
                update: {},
                create: { name: algorithmName!, slug: algorithmSlug! },
                select: { id: true, name: true },
            })
        }

        let family: { id: string; name: string }
        if (modelFamilyId) {
            const found = await prisma.modelFamily.findUnique({
                where: { id: modelFamilyId },
                select: { id: true, name: true },
            })
            if (!found) throw new Error(`model family not found with ID: ${modelFamilyId}`)
            family = found
        } else {
            family = await prisma.modelFamily.upsert({
                where: { name: modelFamilyName! },
                update: { algorithmId: algorithm.id }, // ensure it's linked correctly
                create: { name: modelFamilyName!, slug: modelFamilySlug!, algorithmId: algorithm.id },
                select: { id: true, name: true },
            })
        }

        const modelInstance = await prisma.modelInstance.upsert({
            where: {
                modelFamilyId_versionMajor_versionMinor_versionPatch_versionPrerelease: {
                    modelFamilyId: family.id,
                    versionMajor,
                    versionMinor,
                    versionPatch,
                    versionPrerelease: versionPrerelease || '',
                },
            },
            update: { description: modelDescription },
            create: {
                modelFamilyId: family.id,
                slug: modelSlug!,
                description: modelDescription,
                versionMajor,
                versionMinor,
                versionPatch,
                versionPrerelease: versionPrerelease || '',
            },
            select: { id: true },
        })

        console.log(
            `  OK: Benchmark='${benchmark.name}', Algorithm='${algorithm.name}', Family='${family.name}', Instance='${modelSlug}'`
        )
        console.log('')

        // --- Step 2: File Paths & Run Creation ---
        const routesFile = path.join(dataDir, '3-processed', benchmark.name, modelPathName, 'routes.json.gz')
        if (!fileExists(routesFile)) throw new Error(`routes file not found: ${routesFile}`)

        const manifestFile = path.join(dataDir, '3-processed', benchmark.name, modelPathName, 'manifest.json')
        const manifest = fileExists(manifestFile)
            ? (JSON.parse(fs.readFileSync(manifestFile, 'utf-8')) as ManifestFile)
            : null

        const predictionRun = await createOrUpdatePredictionRun(benchmark.id, modelInstance.id, {
            retrocastVersion: manifest?.retrocast_version,
            executedAt: manifest?.created_at ? new Date(manifest.created_at) : new Date(),
            hourlyCost: hourlyCost ?? undefined,
        })
        console.log(`prediction run upserted: ${predictionRun.id}`)
        console.log('')

        // --- Step 3: Load Routes ---
        console.log(`loading routes from ${routesFile}...`)
        const routesData = await readGzipJson<RoutesFile>(routesFile)
        let routesCreated = 0
        const targetIdsInFile = Object.keys(routesData)

        for (const [i, externalTargetId] of targetIdsInFile.entries()) {
            if (i % 20 === 0) console.log(`  target ${i + 1}/${targetIdsInFile.length}...`)
            const target = await prisma.benchmarkTarget.findUnique({
                where: { benchmarkSetId_targetId: { benchmarkSetId: benchmark.id, targetId: externalTargetId } },
                select: { id: true },
            })
            if (!target) {
                console.warn(`  skipping: target '${externalTargetId}' not found in benchmark '${benchmark.name}'`)
                continue
            }
            for (const pythonRoute of routesData[externalTargetId]) {
                await createRouteFromPython(pythonRoute, predictionRun.id, target.id)
                routesCreated++
            }
        }
        console.log(`  routes created: ${routesCreated}`)
        console.log('')

        // --- Step 4: Load Evaluations & Stats (if applicable) ---
        let stock: { id: string; name: string } | null = null
        if (!routesOnly && stockPathName && stockDbName) {
            stock = await prisma.stock.findUnique({ where: { name: stockDbName }, select: { id: true, name: true } })
            if (!stock) throw new Error(`stock '${stockDbName}' not found in database.`)

            const evaluationFile = path.join(
                dataDir,
                '4-scored',
                benchmark.name,
                modelPathName,
                stockPathName,
                'evaluation.json.gz'
            )
            const statisticsFile = path.join(
                dataDir,
                '5-results',
                benchmark.name,
                modelPathName,
                stockPathName,
                'statistics.json.gz'
            )

            if (!fileExists(evaluationFile)) throw new Error(`evaluation file not found: ${evaluationFile}`)
            if (!fileExists(statisticsFile)) throw new Error(`statistics file not found: ${statisticsFile}`)

            // Load Evaluations
            console.log(`loading evaluations for stock '${stock.name}'...`)
            const evaluationData = await readGzipJson<EvaluationFile>(evaluationFile)
            let solvabilityRecordsCreated = 0
            for (const externalTargetId in evaluationData.results) {
                const targetEval = evaluationData.results[externalTargetId]
                const target = await prisma.benchmarkTarget.findUnique({
                    where: { benchmarkSetId_targetId: { benchmarkSetId: benchmark.id, targetId: externalTargetId } },
                    select: { id: true },
                })
                if (!target) continue

                const predictionRoutes = await prisma.predictionRoute.findMany({
                    where: { targetId: target.id, predictionRunId: predictionRun.id },
                    select: { id: true, rank: true },
                })
                const rankToIdMap = new Map(predictionRoutes.map((pr) => [pr.rank, pr.id]))

                for (const routeEval of targetEval.routes) {
                    const predictionRouteId = rankToIdMap.get(routeEval.rank)
                    if (!predictionRouteId) continue
                    await createRouteSolvability(
                        predictionRouteId,
                        stock.id,
                        routeEval.is_solved,
                        routeEval.matches_acceptable,
                        routeEval.matched_acceptable_index,
                        targetEval.stratification_length,
                        targetEval.stratification_is_convergent,
                        targetEval.wall_time,
                        targetEval.cpu_time
                    )
                    solvabilityRecordsCreated++
                }
            }
            console.log(`  solvability records created: ${solvabilityRecordsCreated}`)
            console.log('')

            // Load Statistics
            console.log('loading statistics...')
            const rawStats = await readGzipJson<PythonModelStatistics>(statisticsFile)
            const transformedStats = transformPythonStatistics(rawStats)
            await createModelStatistics(predictionRun.id, benchmark.id, stock.id, transformedStats)
            console.log(`  statistics loaded.`)
            console.log('')
        }

        // --- Step 5: Finalize and Report ---
        console.log('updating run aggregates...')
        await updatePredictionRunStats(predictionRun.id)
        if (hourlyCost !== null) {
            await updatePredictionRunCost(predictionRun.id)
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
        console.log('='.repeat(70))
        console.log('load complete!')
        console.log(
            `summary: loaded ${routesCreated} routes for '${family.name} ${versionString}' on '${benchmark.name}'`
        )
        if (stock) console.log(`         with evaluation against '${stock.name}' stock.`)
        console.log(`time elapsed: ${elapsed}s`)
        console.log('='.repeat(70))
        process.exit(0)
    } catch (error) {
        console.error('')
        console.error('='.repeat(70))
        console.error('fatal error during script execution')
        console.error('='.repeat(70))
        console.error(error instanceof Error ? error.message : String(error))
        console.error('='.repeat(70))
        process.exit(1)
    }
}

void main().catch((error) => {
    console.error('unhandled promise rejection:', error instanceof Error ? error.message : String(error))
    process.exit(1)
})
