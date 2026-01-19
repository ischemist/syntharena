#!/usr/bin/env tsx

/**
 * CLI Script to load model predictions from retrocast pipeline outputs.
 *
 * Usage:
 *   tsx scripts/load-predictions.ts [options]
 *
 * Benchmark (one required):
 *   <benchmark-name>           First positional arg: name of benchmark to find
 *   --benchmark-id <id>        OR: benchmark ID for existing benchmark
 *
 * Model Instance (one required):
 *   <model-name>               Second positional arg: name for new model instance
 *     --model-slug <slug>      Required when creating: URL-safe slug
 *     --model-description      Optional description
 *     --version-major <n>      Major version (default: 0)
 *     --version-minor <n>      Minor version (default: 0)
 *     --version-patch <n>      Patch version (default: 0)
 *     --version-prerelease <s> Prerelease tag (e.g., "alpha", "beta.1")
 *   --model-id <id>            OR: model instance ID for existing model
 *
 * Algorithm (one required):
 *   --algorithm <name>         Algorithm name (creates/finds by name)
 *     --algorithm-slug <slug>  Required when creating: URL-safe slug
 *     --algorithm-paper <url>  Optional paper URL
 *     --algorithm-description  Optional description
 *     --algorithm-code-url     Optional code repository URL
 *     --algorithm-bibtex       Optional BibTeX citation
 *   --algorithm-id <id>        OR: algorithm ID for existing algorithm
 *
 * Stock (for evaluations):
 *   --stock-path <name>        Stock name in file path (e.g., "buyables-stock")
 *   --stock-db <name>          Stock name in database
 *   --stock-id <id>            OR: stock ID for existing stock
 *
 * Other Options:
 *   --data-dir <path>          Base data directory (default: ../project-procrustes/data)
 *   --routes-only              Only load routes, skip evaluations and statistics
 *   --hourly-cost <usd>        Compute cost in USD per hour
 *
 * Examples:
 *   # Create new algorithm and model (routes only):
 *   pnpm tsx scripts/load-predictions.ts mkt-cnv-160 dms-explorer-xl \
 *     --algorithm DirectMultiStep --algorithm-slug direct-multi-step \
 *     --model-slug dms-explorer-xl-v0-0-0 --routes-only
 *
 *   # Create new model with version:
 *   pnpm tsx scripts/load-predictions.ts mkt-cnv-160 dms-explorer-xl \
 *     --algorithm DirectMultiStep --algorithm-slug direct-multi-step \
 *     --model-slug dms-explorer-xl-v1-0-0 \
 *     --version-major 1 --version-minor 0 --version-patch 0 \
 *     --stock-path buyables-stock --stock-db "ASKCOS Buyables Stock"
 *
 *   # Load into existing entities by ID:
 *   pnpm tsx scripts/load-predictions.ts --benchmark-id abc123 --model-id def456 \
 *     --algorithm-id ghi789 --stock-path buyables-stock --stock-id jkl012
 *
 * File Structure Expected:
 *   {data-dir}/3-processed/{benchmark}/{model}/routes.json.gz
 *   {data-dir}/4-scored/{benchmark}/{model}/{stock-path}/evaluation.json.gz
 *   {data-dir}/5-results/{benchmark}/{model}/{stock-path}/statistics.json.gz
 *
 * The script will:
 *   1. Resolve or create Algorithm and ModelInstance
 *   2. Create or update PredictionRun for benchmark+model combination
 *   3. Load routes from 3-processed (creates Route + RouteNode tree + Molecules)
 *   4. If --stock specified:
 *      - Load evaluations from 4-scored (creates RouteSolvability records)
 *      - Load statistics from 5-results (creates ModelRunStatistics + StratifiedMetricGroup)
 *   5. Update aggregate statistics on PredictionRun
 *   6. Report summary
 */
// import * as fs from 'fs'
// import * as path from 'path'
// import * as zlib from 'zlib'

// import './env-loader'

// import prisma from '../src/lib/db'
// import {
//     createModelStatistics,
//     createOrUpdatePredictionRun,
//     createRouteFromPython,
//     createRouteSolvability,
//     transformPythonStatistics,
//     updatePredictionRunCost,
//     updatePredictionRunStats,
//     type PythonModelStatistics,
//     type PythonRoute,
// } from '../src/lib/services/loaders/prediction-loader.service'

// // ============================================================================
// // Types for File Formats
// // ============================================================================

// interface RoutesFile {
//     [targetId: string]: PythonRoute[]
// }

// interface EvaluationFile {
//     model_name: string
//     benchmark_name: string
//     stock_name: string
//     has_acceptable_routes: boolean
//     results: {
//         [targetId: string]: {
//             target_id: string
//             routes: Array<{
//                 rank: number
//                 is_solved: boolean
//                 matches_acceptable: boolean
//                 matched_acceptable_index: number | null
//             }>
//             is_solvable: boolean
//             acceptable_rank: number | null
//             // Stratification fields (renamed in Python TargetEvaluation)
//             stratification_length: number | null
//             stratification_is_convergent: boolean | null
//             // Runtime metrics (in seconds)
//             wall_time: number | null
//             cpu_time: number | null
//         }
//     }
// }

// interface ManifestFile {
//     schema_version: string
//     retrocast_version: string
//     created_at: string
//     action: string
//     parameters: Record<string, unknown>
// }

// // ============================================================================
// // Helper Functions
// // ============================================================================

// /** Parsed CLI options */
// interface ParsedOptions {
//     // Benchmark identification (name OR id)
//     benchmarkName: string | null
//     benchmarkId: string | null
//     // Model identification (name OR id)
//     modelName: string | null
//     modelId: string | null
//     // Algorithm identification (name OR id)
//     algorithmName: string | null
//     algorithmId: string | null
//     // Algorithm creation options (when using --algorithm)
//     algorithmSlug: string | null
//     algorithmPaper: string | null
//     algorithmDescription: string | null
//     algorithmCodeUrl: string | null
//     algorithmBibtex: string | null
//     // Model creation options (when using <model-name>)
//     modelSlug: string | null
//     modelDescription: string | null
//     versionMajor: number
//     versionMinor: number
//     versionPatch: number
//     versionPrerelease: string | null
//     // Stock identification
//     stockPathName: string | null
//     stockDbName: string | null
//     stockId: string | null
//     // Other options
//     dataDir: string
//     routesOnly: boolean
//     hourlyCost: number | null
// }

// /**
//  * Parses CLI arguments into structured options.
//  */
// function parseArgs(args: string[]): ParsedOptions {
//     // Positional args are optional now (can use --benchmark-id and --model-id instead)
//     let benchmarkName: string | null = null
//     let modelName: string | null = null
//     let benchmarkId: string | null = null
//     let modelId: string | null = null
//     let algorithmName: string | null = null
//     let algorithmId: string | null = null
//     let algorithmSlug: string | null = null
//     let algorithmPaper: string | null = null
//     let algorithmDescription: string | null = null
//     let algorithmCodeUrl: string | null = null
//     let algorithmBibtex: string | null = null
//     let modelSlug: string | null = null
//     let modelDescription: string | null = null
//     let versionMajor = 0
//     let versionMinor = 0
//     let versionPatch = 0
//     let versionPrerelease: string | null = null
//     let dataDir = path.resolve(__dirname, '../../project-procrustes/data/retrocast')
//     let stockPathName: string | null = null
//     let stockDbName: string | null = null
//     let stockId: string | null = null
//     let routesOnly = false
//     let hourlyCost: number | null = null

//     // First pass: collect positional args (benchmark-name, model-name)
//     const positionalArgs: string[] = []
//     for (let i = 0; i < args.length; i++) {
//         if (args[i].startsWith('--')) {
//             // Skip this option and its value if it has one
//             const optionsWithValues = [
//                 '--data-dir',
//                 '--stock-path',
//                 '--stock-db',
//                 '--stock-id',
//                 '--algorithm',
//                 '--algorithm-id',
//                 '--algorithm-slug',
//                 '--algorithm-paper',
//                 '--algorithm-description',
//                 '--algorithm-code-url',
//                 '--algorithm-bibtex',
//                 '--model-id',
//                 '--model-slug',
//                 '--model-description',
//                 '--version-major',
//                 '--version-minor',
//                 '--version-patch',
//                 '--version-prerelease',
//                 '--benchmark-id',
//                 '--hourly-cost',
//             ]
//             if (optionsWithValues.includes(args[i]) && i + 1 < args.length) {
//                 i++ // skip the value
//             }
//             // --routes-only has no value, so nothing extra to skip
//         } else {
//             positionalArgs.push(args[i])
//         }
//     }

//     // Assign positional args
//     if (positionalArgs.length >= 1) benchmarkName = positionalArgs[0]
//     if (positionalArgs.length >= 2) modelName = positionalArgs[1]

//     // Parse options
//     for (let i = 0; i < args.length; i++) {
//         if (args[i] === '--data-dir' && i + 1 < args.length) {
//             dataDir = path.resolve(args[i + 1])
//             i++
//         } else if (args[i] === '--stock-path' && i + 1 < args.length) {
//             stockPathName = args[i + 1]
//             i++
//         } else if (args[i] === '--stock-db' && i + 1 < args.length) {
//             stockDbName = args[i + 1]
//             i++
//         } else if (args[i] === '--stock-id' && i + 1 < args.length) {
//             stockId = args[i + 1]
//             i++
//         } else if (args[i] === '--algorithm' && i + 1 < args.length) {
//             algorithmName = args[i + 1]
//             i++
//         } else if (args[i] === '--algorithm-id' && i + 1 < args.length) {
//             algorithmId = args[i + 1]
//             i++
//         } else if (args[i] === '--algorithm-slug' && i + 1 < args.length) {
//             algorithmSlug = args[i + 1]
//             i++
//         } else if (args[i] === '--algorithm-paper' && i + 1 < args.length) {
//             algorithmPaper = args[i + 1]
//             i++
//         } else if (args[i] === '--algorithm-description' && i + 1 < args.length) {
//             algorithmDescription = args[i + 1]
//             i++
//         } else if (args[i] === '--algorithm-code-url' && i + 1 < args.length) {
//             algorithmCodeUrl = args[i + 1]
//             i++
//         } else if (args[i] === '--algorithm-bibtex' && i + 1 < args.length) {
//             algorithmBibtex = args[i + 1]
//             i++
//         } else if (args[i] === '--benchmark-id' && i + 1 < args.length) {
//             benchmarkId = args[i + 1]
//             i++
//         } else if (args[i] === '--model-id' && i + 1 < args.length) {
//             modelId = args[i + 1]
//             i++
//         } else if (args[i] === '--model-slug' && i + 1 < args.length) {
//             modelSlug = args[i + 1]
//             i++
//         } else if (args[i] === '--model-description' && i + 1 < args.length) {
//             modelDescription = args[i + 1]
//             i++
//         } else if (args[i] === '--version-major' && i + 1 < args.length) {
//             versionMajor = parseInt(args[i + 1], 10)
//             if (isNaN(versionMajor) || versionMajor < 0) {
//                 throw new Error('--version-major must be a non-negative integer')
//             }
//             i++
//         } else if (args[i] === '--version-minor' && i + 1 < args.length) {
//             versionMinor = parseInt(args[i + 1], 10)
//             if (isNaN(versionMinor) || versionMinor < 0) {
//                 throw new Error('--version-minor must be a non-negative integer')
//             }
//             i++
//         } else if (args[i] === '--version-patch' && i + 1 < args.length) {
//             versionPatch = parseInt(args[i + 1], 10)
//             if (isNaN(versionPatch) || versionPatch < 0) {
//                 throw new Error('--version-patch must be a non-negative integer')
//             }
//             i++
//         } else if (args[i] === '--version-prerelease' && i + 1 < args.length) {
//             versionPrerelease = args[i + 1]
//             i++
//         } else if (args[i] === '--hourly-cost' && i + 1 < args.length) {
//             hourlyCost = parseFloat(args[i + 1])
//             if (isNaN(hourlyCost) || hourlyCost < 0) {
//                 throw new Error('--hourly-cost must be a positive number')
//             }
//             i++
//         } else if (args[i] === '--routes-only') {
//             routesOnly = true
//         } else if (!args[i].startsWith('--')) {
//             // positional arg, already handled
//         } else {
//             throw new Error(`Unknown option: ${args[i]}`)
//         }
//     }

//     // Validation: need either benchmark name or id
//     if (!benchmarkName && !benchmarkId) {
//         throw new Error('Must specify either <benchmark-name> or --benchmark-id')
//     }
//     if (benchmarkName && benchmarkId) {
//         throw new Error('Cannot specify both <benchmark-name> and --benchmark-id')
//     }

//     // Validation: need either model name or id
//     if (!modelName && !modelId) {
//         throw new Error('Must specify either <model-name> or --model-id')
//     }
//     if (modelName && modelId) {
//         throw new Error('Cannot specify both <model-name> and --model-id')
//     }

//     // Validation: need either algorithm name or id
//     if (!algorithmName && !algorithmId) {
//         throw new Error('Must specify either --algorithm <name> or --algorithm-id <id>')
//     }
//     if (algorithmName && algorithmId) {
//         throw new Error('Cannot specify both --algorithm and --algorithm-id')
//     }

//     // Validation: if creating algorithm (by name), slug is required
//     if (algorithmName && !algorithmSlug) {
//         throw new Error('When creating algorithm with --algorithm, --algorithm-slug is required')
//     }

//     // Validation: if creating model (by name), slug is required
//     if (modelName && !modelSlug) {
//         throw new Error('When creating model with <model-name>, --model-slug is required')
//     }

//     // Validation: stock options - if stock-path specified, need either stock-db or stock-id
//     if (stockPathName && !stockDbName && !stockId) {
//         throw new Error('When using --stock-path, must specify either --stock-db or --stock-id')
//     }
//     if (stockDbName && stockId) {
//         throw new Error('Cannot specify both --stock-db and --stock-id')
//     }

//     return {
//         benchmarkName,
//         benchmarkId,
//         modelName,
//         modelId,
//         algorithmName,
//         algorithmId,
//         algorithmSlug,
//         algorithmPaper,
//         algorithmDescription,
//         algorithmCodeUrl,
//         algorithmBibtex,
//         modelSlug,
//         modelDescription,
//         versionMajor,
//         versionMinor,
//         versionPatch,
//         versionPrerelease,
//         dataDir,
//         stockPathName,
//         stockDbName,
//         stockId,
//         routesOnly,
//         hourlyCost,
//     }
// }

// /**
//  * Reads and decompresses a .json.gz file.
//  */
// async function readGzipJson<T>(filePath: string): Promise<T> {
//     return new Promise((resolve, reject) => {
//         const chunks: Buffer[] = []
//         fs.createReadStream(filePath)
//             .pipe(zlib.createGunzip())
//             .on('data', (chunk) => chunks.push(chunk))
//             .on('end', () => {
//                 try {
//                     const json = Buffer.concat(chunks).toString('utf-8')
//                     resolve(JSON.parse(json))
//                 } catch (error) {
//                     reject(error)
//                 }
//             })
//             .on('error', reject)
//     })
// }

// /**
//  * Checks if a file exists.
//  */
// function fileExists(filePath: string): boolean {
//     try {
//         return fs.statSync(filePath).isFile()
//     } catch {
//         return false
//     }
// }

// // ============================================================================
// // Main Loading Logic
// // ============================================================================

// async function main() {
//     const args = process.argv.slice(2)

//     // Show usage if no args
//     if (args.length === 0) {
//         console.error('Usage: tsx scripts/load-predictions.ts [options]')
//         console.error('')
//         console.error('Benchmark (one required):')
//         console.error('  <benchmark-name>           Name of benchmark (first positional arg)')
//         console.error('  --benchmark-id <id>        OR benchmark ID for existing benchmark')
//         console.error('')
//         console.error('Model Instance (one required):')
//         console.error('  <model-name>               Name for new model instance (second positional arg)')
//         console.error('    --model-slug <slug>      Required when creating: URL-safe slug')
//         console.error('    --model-description      Optional description')
//         console.error('    --version-major <n>      Major version (default: 0)')
//         console.error('    --version-minor <n>      Minor version (default: 0)')
//         console.error('    --version-patch <n>      Patch version (default: 0)')
//         console.error('    --version-prerelease <s> Prerelease tag (e.g., "alpha", "beta.1")')
//         console.error('  --model-id <id>            OR model instance ID for existing model')
//         console.error('')
//         console.error('Algorithm (one required):')
//         console.error('  --algorithm <name>         Algorithm name for new/existing algorithm')
//         console.error('    --algorithm-slug <slug>  Required when creating: URL-safe slug')
//         console.error('    --algorithm-paper <url>  Optional paper URL')
//         console.error('    --algorithm-description  Optional description')
//         console.error('    --algorithm-code-url     Optional code repository URL')
//         console.error('    --algorithm-bibtex       Optional BibTeX citation')
//         console.error('  --algorithm-id <id>        OR algorithm ID for existing algorithm')
//         console.error('')
//         console.error('Stock (for evaluations):')
//         console.error('  --stock-path <name>        Stock name in file path (e.g., "buyables-stock")')
//         console.error('  --stock-db <name>          Stock name in database')
//         console.error('  --stock-id <id>            OR stock ID for existing stock')
//         console.error('')
//         console.error('Other Options:')
//         console.error('  --data-dir <path>          Base data directory (default: ../project-procrustes/data)')
//         console.error('  --routes-only              Only load routes, skip evaluations and statistics')
//         console.error('  --hourly-cost <usd>        Compute cost in USD per hour')
//         console.error('')
//         console.error('Examples:')
//         console.error('  # Create new algorithm and model:')
//         console.error('  pnpm tsx scripts/load-predictions.ts mkt-cnv-160 dms-explorer-xl \\')
//         console.error('    --algorithm DirectMultiStep --algorithm-slug direct-multi-step \\')
//         console.error('    --model-slug dms-explorer-xl-v0-0-0 --routes-only')
//         console.error('')
//         console.error('  # Load into existing algorithm and model by ID:')
//         console.error('  pnpm tsx scripts/load-predictions.ts --benchmark-id abc123 --model-id def456 \\')
//         console.error('    --algorithm-id ghi789 --stock-path buyables-stock --stock-id jkl012')
//         process.exit(1)
//     }

//     let options
//     try {
//         options = parseArgs(args)
//     } catch (error) {
//         console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
//         process.exit(1)
//     }

//     const {
//         benchmarkName,
//         benchmarkId,
//         modelName,
//         modelId,
//         algorithmName,
//         algorithmId,
//         algorithmSlug,
//         algorithmPaper,
//         algorithmDescription,
//         algorithmCodeUrl,
//         algorithmBibtex,
//         modelSlug,
//         modelDescription,
//         versionMajor,
//         versionMinor,
//         versionPatch,
//         versionPrerelease,
//         dataDir,
//         stockPathName,
//         stockDbName,
//         stockId,
//         routesOnly,
//         hourlyCost,
//     } = options

//     // Format version string for display
//     const versionString = versionPrerelease
//         ? `${versionMajor}.${versionMinor}.${versionPatch}-${versionPrerelease}`
//         : `${versionMajor}.${versionMinor}.${versionPatch}`

//     console.log('='.repeat(70))
//     console.log('Model Predictions Loader')
//     console.log('='.repeat(70))
//     console.log(`Benchmark:        ${benchmarkName ?? `(by ID: ${benchmarkId})`}`)
//     console.log(`Algorithm:        ${algorithmName ?? `(by ID: ${algorithmId})`}`)
//     console.log(`Model:            ${modelName ?? `(by ID: ${modelId})`}`)
//     if (modelName) {
//         console.log(`  Slug:           ${modelSlug}`)
//         console.log(`  Version:        ${versionString}`)
//     }
//     console.log(`Data Directory:   ${dataDir}`)
//     console.log(`Stock (path):     ${stockPathName ?? '(none - routes only)'}`)
//     console.log(`Stock (DB/ID):    ${stockDbName ?? stockId ?? '(none - routes only)'}`)
//     console.log(`Hourly Cost:      ${hourlyCost !== null ? `$${hourlyCost.toFixed(2)}/hr` : '(none)'}`)
//     console.log(`Mode:             ${routesOnly ? 'Routes Only' : 'Full Load'}`)
//     console.log('='.repeat(70))
//     console.log('')

//     const startTime = Date.now()

//     try {
//         // ====================================================================
//         // Step 1: Resolve benchmark, algorithm, and model
//         // ====================================================================

//         // --- Benchmark ---
//         console.log('Resolving benchmark...')
//         let benchmark: { id: string; name: string }
//         if (benchmarkId) {
//             const found = await prisma.benchmarkSet.findUnique({
//                 where: { id: benchmarkId },
//                 select: { id: true, name: true },
//             })
//             if (!found) {
//                 throw new Error(`Benchmark not found with ID: ${benchmarkId}`)
//             }
//             benchmark = found
//         } else {
//             const found = await prisma.benchmarkSet.findFirst({
//                 where: { name: benchmarkName! },
//                 select: { id: true, name: true },
//             })
//             if (!found) {
//                 throw new Error(
//                     `Benchmark not found in database: ${benchmarkName}. Please load the benchmark first using load-benchmark.ts`
//                 )
//             }
//             benchmark = found
//         }
//         console.log(`  Benchmark ID: ${benchmark.id} (${benchmark.name})`)
//         console.log('')

//         // --- Algorithm ---
//         console.log('Resolving algorithm...')
//         let algorithm: { id: string; name: string }
//         if (algorithmId) {
//             // Find by ID
//             const found = await prisma.algorithm.findUnique({
//                 where: { id: algorithmId },
//                 select: { id: true, name: true },
//             })
//             if (!found) {
//                 throw new Error(`Algorithm not found with ID: ${algorithmId}`)
//             }
//             algorithm = found
//             console.log(`  Found Algorithm ID: ${algorithm.id} (${algorithm.name})`)
//         } else {
//             // Upsert by name (create with slug if new)
//             algorithm = await prisma.algorithm.upsert({
//                 where: { name: algorithmName! },
//                 update: {
//                     // Update optional fields if provided
//                     ...(algorithmPaper && { paper: algorithmPaper }),
//                     ...(algorithmDescription && { description: algorithmDescription }),
//                     ...(algorithmCodeUrl && { codeUrl: algorithmCodeUrl }),
//                     ...(algorithmBibtex && { bibtex: algorithmBibtex }),
//                 },
//                 create: {
//                     name: algorithmName!,
//                     slug: algorithmSlug!,
//                     paper: algorithmPaper,
//                     description: algorithmDescription,
//                     codeUrl: algorithmCodeUrl,
//                     bibtex: algorithmBibtex,
//                 },
//                 select: { id: true, name: true },
//             })
//             console.log(`  Algorithm ID: ${algorithm.id} (${algorithm.name})`)
//         }
//         console.log('')

//         // --- Model Instance ---
//         console.log('Resolving model instance...')
//         let model: { id: string; name: string }
//         if (modelId) {
//             // Find by ID
//             const found = await prisma.modelInstance.findUnique({
//                 where: { id: modelId },
//                 select: { id: true, name: true },
//             })
//             if (!found) {
//                 throw new Error(`Model instance not found with ID: ${modelId}`)
//             }
//             model = found
//             console.log(`  Found Model ID: ${model.id} (${model.name})`)
//         } else {
//             // Find existing or create new model instance
//             const existingModel = await prisma.modelInstance.findFirst({
//                 where: {
//                     name: modelName!,
//                     versionMajor,
//                     versionMinor,
//                     versionPatch,
//                     versionPrerelease: versionPrerelease ?? null,
//                 },
//                 select: { id: true, name: true },
//             })

//             if (existingModel) {
//                 // Update description if provided
//                 if (modelDescription) {
//                     await prisma.modelInstance.update({
//                         where: { id: existingModel.id },
//                         data: { description: modelDescription },
//                     })
//                 }
//                 model = existingModel
//                 console.log(`  Found Model ID: ${model.id} (${model.name} v${versionString})`)
//             } else {
//                 // Create new model instance
//                 model = await prisma.modelInstance.create({
//                     data: {
//                         algorithmId: algorithm.id,
//                         name: modelName!,
//                         slug: modelSlug!,
//                         description: modelDescription,
//                         versionMajor,
//                         versionMinor,
//                         versionPatch,
//                         versionPrerelease,
//                     },
//                     select: { id: true, name: true },
//                 })
//                 console.log(`  Created Model ID: ${model.id} (${model.name} v${versionString})`)
//             }
//         }
//         console.log('')

//         // ====================================================================
//         // Step 2: Resolve file paths and check existence
//         // ====================================================================
//         // Use benchmark name and model name for file paths (need actual names, not IDs)
//         const routesFile = path.join(dataDir, '3-processed', benchmark.name, model.name, 'routes.json.gz')
//         const manifestFile = path.join(dataDir, '3-processed', benchmark.name, model.name, 'manifest.json')

//         console.log('Checking files...')
//         console.log(`  Routes file: ${routesFile}`)

//         if (!fileExists(routesFile)) {
//             throw new Error(`Routes file not found: ${routesFile}`)
//         }

//         let manifest: ManifestFile | null = null
//         if (fileExists(manifestFile)) {
//             manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'))
//             console.log(`  Manifest:    Found (retrocast ${manifest?.retrocast_version})`)
//         } else {
//             console.log(`  Manifest:    Not found (will use defaults)`)
//         }

//         // Check evaluation and statistics files if stock specified
//         let evaluationFile: string | null = null
//         let statisticsFile: string | null = null

//         if (stockPathName && !routesOnly) {
//             evaluationFile = path.join(
//                 dataDir,
//                 '4-scored',
//                 benchmark.name,
//                 model.name,
//                 stockPathName,
//                 'evaluation.json.gz'
//             )
//             statisticsFile = path.join(
//                 dataDir,
//                 '5-results',
//                 benchmark.name,
//                 model.name,
//                 stockPathName,
//                 'statistics.json.gz'
//             )

//             console.log(`  Evaluation:  ${evaluationFile}`)
//             console.log(`  Statistics:  ${statisticsFile}`)

//             if (!fileExists(evaluationFile)) {
//                 throw new Error(`Evaluation file not found: ${evaluationFile}`)
//             }
//             if (!fileExists(statisticsFile)) {
//                 throw new Error(`Statistics file not found: ${statisticsFile}`)
//             }
//         }

//         console.log('')

//         // ====================================================================
//         // Step 3: Create or update PredictionRun
//         // ====================================================================
//         console.log('Creating/updating prediction run...')

//         const predictionRun = await createOrUpdatePredictionRun(benchmark.id, model.id, {
//             retrocastVersion: manifest?.retrocast_version ?? undefined,
//             executedAt: manifest?.created_at ? new Date(manifest.created_at) : new Date(),
//             hourlyCost: hourlyCost ?? undefined,
//         })

//         console.log(`  Prediction Run ID: ${predictionRun.id}`)
//         console.log('')

//         // ====================================================================
//         // Step 4: Load routes from 3-processed
//         // ====================================================================
//         console.log('Loading routes from file...')
//         const routesData = await readGzipJson<RoutesFile>(routesFile)

//         const targetIds = Object.keys(routesData)
//         console.log(`  Found ${targetIds.length} targets`)

//         let routesCreated = 0
//         let targetsFailed = 0

//         for (let i = 0; i < targetIds.length; i++) {
//             const externalTargetId = targetIds[i]
//             const routes = routesData[externalTargetId]

//             // Show progress every 10 targets
//             if (i % 10 === 0) {
//                 console.log(`  Processing target ${i + 1}/${targetIds.length}: ${externalTargetId}`)
//             }

//             try {
//                 // Find BenchmarkTarget by targetId (the external ID from Python)
//                 const target = await prisma.benchmarkTarget.findFirst({
//                     where: {
//                         benchmarkSetId: benchmark.id,
//                         targetId: externalTargetId,
//                     },
//                     select: { id: true },
//                 })

//                 if (!target) {
//                     console.warn(`  Warning: Target not found in database: ${externalTargetId} (skipping)`)
//                     targetsFailed++
//                     continue
//                 }

//                 // Create each route for this target
//                 for (const pythonRoute of routes) {
//                     await createRouteFromPython(pythonRoute, predictionRun.id, target.id)
//                     routesCreated++
//                 }
//             } catch (error) {
//                 console.error(
//                     `  Error processing target ${externalTargetId}: ${error instanceof Error ? error.message : String(error)}`
//                 )
//                 targetsFailed++
//             }
//         }

//         console.log(`  Routes created: ${routesCreated}`)
//         if (targetsFailed > 0) {
//             console.log(`  Targets failed: ${targetsFailed}`)
//         }
//         console.log('')

//         // ====================================================================
//         // Step 5: Load evaluations (if stock specified)
//         // ====================================================================
//         if (stockPathName && (stockDbName || stockId) && !routesOnly && evaluationFile) {
//             // Resolve stock by ID or name
//             let stock: { id: string; name: string }
//             if (stockId) {
//                 const found = await prisma.stock.findUnique({
//                     where: { id: stockId },
//                     select: { id: true, name: true },
//                 })
//                 if (!found) {
//                     throw new Error(`Stock not found with ID: ${stockId}`)
//                 }
//                 stock = found
//                 console.log(`Loading evaluations for stock: ${stock.name} (ID: ${stock.id})...`)
//             } else {
//                 const found = await prisma.stock.findFirst({
//                     where: { name: stockDbName! },
//                     select: { id: true, name: true },
//                 })
//                 if (!found) {
//                     // Show available stocks to help user
//                     const availableStocks = await prisma.stock.findMany({
//                         select: { name: true },
//                     })
//                     const stockNames = availableStocks.map((s) => s.name).join(', ')
//                     throw new Error(`Stock not found in database: ${stockDbName}. Available stocks: ${stockNames}`)
//                 }
//                 stock = found
//                 console.log(`Loading evaluations for stock: ${stock.name}...`)
//             }

//             console.log(`  Stock ID: ${stock.id}`)

//             const evaluationData = await readGzipJson<EvaluationFile>(evaluationFile)
//             const evalTargetIds = Object.keys(evaluationData.results)

//             console.log(`  Found evaluations for ${evalTargetIds.length} targets`)

//             let solvabilityRecordsCreated = 0

//             for (let i = 0; i < evalTargetIds.length; i++) {
//                 const externalTargetId = evalTargetIds[i]
//                 const targetEval = evaluationData.results[externalTargetId]

//                 if (i % 10 === 0) {
//                     console.log(`  Processing evaluation ${i + 1}/${evalTargetIds.length}: ${externalTargetId}`)
//                 }

//                 try {
//                     // Find target by targetId (the external ID from Python)
//                     const target = await prisma.benchmarkTarget.findFirst({
//                         where: {
//                             benchmarkSetId: benchmark.id,
//                             targetId: externalTargetId,
//                         },
//                         select: { id: true },
//                     })

//                     if (!target) {
//                         console.warn(`  Warning: Target not found: ${externalTargetId} (skipping)`)
//                         continue
//                     }

//                     // Find prediction routes for this target in this prediction run
//                     const predictionRoutes = await prisma.predictionRoute.findMany({
//                         where: {
//                             targetId: target.id,
//                             predictionRunId: predictionRun.id,
//                         },
//                         select: { id: true, rank: true },
//                         orderBy: { rank: 'asc' },
//                     })

//                     // Match prediction routes by rank and create solvability records
//                     for (const routeEval of targetEval.routes) {
//                         const predictionRoute = predictionRoutes.find((pr) => pr.rank === routeEval.rank)
//                         if (!predictionRoute) {
//                             console.warn(
//                                 `  Warning: Route rank ${routeEval.rank} not found for target ${externalTargetId} (skipping)`
//                             )
//                             continue
//                         }

//                         await createRouteSolvability(
//                             predictionRoute.id,
//                             stock.id,
//                             routeEval.is_solved,
//                             routeEval.matches_acceptable,
//                             routeEval.matched_acceptable_index,
//                             targetEval.stratification_length,
//                             targetEval.stratification_is_convergent,
//                             targetEval.wall_time,
//                             targetEval.cpu_time
//                         )
//                         solvabilityRecordsCreated++
//                     }
//                 } catch (error) {
//                     console.error(
//                         `  Error processing evaluation for ${externalTargetId}: ${error instanceof Error ? error.message : String(error)}`
//                     )
//                 }
//             }

//             console.log(`  Solvability records created: ${solvabilityRecordsCreated}`)
//             console.log('')

//             // ================================================================
//             // Step 6: Load statistics (if stock specified)
//             // ================================================================
//             console.log('Loading statistics...')

//             // Read raw Python JSON (with snake_case keys)
//             const rawStatisticsData = await readGzipJson<PythonModelStatistics>(statisticsFile!)

//             // Transform snake_case to camelCase
//             const statisticsData = transformPythonStatistics(rawStatisticsData)

//             await createModelStatistics(predictionRun.id, benchmark.id, stock.id, statisticsData)

//             console.log(`  Statistics loaded successfully`)
//             console.log('')

//             // ================================================================
//             // Step 6.5: Calculate and update total cost if hourly cost specified
//             // ================================================================
//             if (hourlyCost !== null) {
//                 console.log('Calculating total cost...')
//                 const costResult = await updatePredictionRunCost(predictionRun.id)
//                 if (costResult) {
//                     console.log(`  Hourly cost:  $${costResult.hourlyCost.toFixed(2)}/hr`)
//                     console.log(`  Total cost:   $${costResult.totalCost.toFixed(2)}`)
//                 } else {
//                     console.log(`  Could not calculate cost (missing runtime statistics)`)
//                 }
//                 console.log('')
//             }
//         }

//         // ====================================================================
//         // Step 7: Update aggregate stats on PredictionRun
//         // ====================================================================
//         console.log('Updating prediction run aggregate statistics...')
//         const runStats = await updatePredictionRunStats(predictionRun.id)
//         console.log(`  Total routes:      ${runStats.totalRoutes}`)
//         console.log(`  Avg route length:  ${runStats.avgRouteLength.toFixed(2)}`)
//         console.log('')

//         const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

//         console.log('='.repeat(70))
//         console.log('Load Complete!')
//         console.log('='.repeat(70))
//         console.log(`Prediction Run ID:    ${predictionRun.id}`)
//         console.log(`Benchmark:            ${benchmark.name}`)
//         console.log(`Model:                ${model.name}`)
//         console.log(`Routes Created:       ${routesCreated}`)
//         if (stockPathName && (stockDbName || stockId) && !routesOnly) {
//             console.log(`Stock (path):         ${stockPathName}`)
//             console.log(`Stock (DB/ID):        ${stockDbName ?? stockId}`)
//             console.log(`Evaluations Loaded:   Yes`)
//             console.log(`Statistics Loaded:    Yes`)
//         } else {
//             console.log(`Evaluations Loaded:   No`)
//             console.log(`Statistics Loaded:    No`)
//         }
//         console.log(`Time Elapsed:         ${elapsed}s`)
//         console.log('='.repeat(70))

//         process.exit(0)
//     } catch (error) {
//         console.error('')
//         console.error('='.repeat(70))
//         console.error('Error!')
//         console.error('='.repeat(70))
//         console.error(error instanceof Error ? error.message : String(error))
//         if (error instanceof Error && error.stack) {
//             console.error('')
//             console.error('Stack trace:')
//             console.error(error.stack)
//         }
//         console.error('='.repeat(70))
//         process.exit(1)
//     }
// }

// void main().catch((error) => {
//     console.error('Fatal error:', error instanceof Error ? error.message : String(error))
//     process.exit(1)
// })
