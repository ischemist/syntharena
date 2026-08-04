import crypto from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as zlib from 'zlib'
import { loadEvaluationBundleForImport } from '@ischemist/retrocast-io'

import { CORPUS_BENCHMARKS, CORPUS_MODELS, CORPUS_STOCKS } from '@/lib/corpus-config'
import { loadCorpusInventory, validateCorpusMatrix } from '@/lib/corpus-inventory'
import prisma from '@/lib/db'
import { createBenchmark, deleteBenchmarkAndDeps } from '@/lib/services/data/benchmark.data'
import type { PythonBenchmarkSet } from '@/lib/services/loaders/benchmark-loader.service'
import { loadBenchmarkData } from '@/lib/services/loaders/benchmark-loader.service'
import {
    createOrUpdatePredictionRun,
    importEvaluationBundle,
    updatePredictionRunCost,
    validateFixedTierZeroEvaluation,
} from '@/lib/services/loaders/prediction-loader.service'
import { loadStockFromBytes } from '@/lib/services/loaders/stock-loader.service'

export interface RebuildCorpusOptions {
    corpusRoot: string
    procrustesRoot?: string
    allowProvisional?: boolean
    limit?: number
    onProgress?: (message: string) => void
}

interface PersistedBenchmarkSource {
    stockId: string
    sourcePath: string | null
    sourceSha256: string | null
    schemaVersion: string | null
    defaultConstraintsJson: string
    targetConstraintsJson: string
    targetCount: number
}

export function benchmarkMatchesVerifiedSource(
    benchmark: PersistedBenchmarkSource,
    expected: Omit<PersistedBenchmarkSource, 'targetCount'> & { targetCount: number }
): boolean {
    const constraintsMatch = (actual: string, wanted: string): boolean => {
        try {
            const canonicalize = (value: unknown): unknown => {
                if (Array.isArray(value)) return value.map(canonicalize)
                if (value && typeof value === 'object') {
                    return Object.fromEntries(
                        Object.entries(value as Record<string, unknown>)
                            .sort(([left], [right]) => left.localeCompare(right))
                            .map(([key, child]) => [key, canonicalize(child)])
                    )
                }
                return value
            }
            return JSON.stringify(canonicalize(JSON.parse(actual))) === JSON.stringify(canonicalize(JSON.parse(wanted)))
        } catch {
            return false
        }
    }
    return (
        benchmark.stockId === expected.stockId &&
        benchmark.targetCount === expected.targetCount &&
        benchmark.sourcePath === expected.sourcePath &&
        benchmark.sourceSha256 === expected.sourceSha256 &&
        benchmark.schemaVersion === expected.schemaVersion &&
        constraintsMatch(benchmark.defaultConstraintsJson, expected.defaultConstraintsJson) &&
        constraintsMatch(benchmark.targetConstraintsJson, expected.targetConstraintsJson)
    )
}

export function publicationStatusForBuild(
    inventoryStatus: 'release-ready' | 'staging' | 'local-provisional',
    importedRuns: number,
    inventoryRuns: number
): 'release-ready' | 'staging' | 'local-provisional' {
    return importedRuns === inventoryRuns ? inventoryStatus : 'local-provisional'
}

function sha256(bytes: Buffer): string {
    return crypto.createHash('sha256').update(bytes).digest('hex')
}

async function verifyCanonicalInput(
    filePath: string,
    manifestPath: string
): Promise<{ bytes: Buffer; sha256: string; schemaVersion: string }> {
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as {
        schema_version?: unknown
        output_files?: Array<{ path?: unknown; file_hash?: unknown; sha256?: unknown }>
    }
    if (typeof manifest.schema_version !== 'string' || !Array.isArray(manifest.output_files)) {
        throw new Error(`Invalid input manifest: ${manifestPath}`)
    }
    const fileName = path.basename(filePath)
    const entry = manifest.output_files.find((output) =>
        typeof output.path === 'string' ? path.basename(output.path) === fileName : false
    )
    const expected = entry?.sha256 ?? entry?.file_hash
    if (typeof expected !== 'string') throw new Error(`Input manifest does not track ${fileName}`)
    // Capture once, then hash and parse this exact buffer. Reopening the path
    // after verification would create a hash-to-import TOCTOU boundary.
    const bytes = await fs.readFile(filePath)
    const actual = sha256(bytes)
    if (actual !== expected) throw new Error(`Input hash mismatch for ${fileName}`)
    return { bytes, sha256: actual, schemaVersion: manifest.schema_version }
}

function readJsonGz(bytes: Buffer): PythonBenchmarkSet {
    return JSON.parse(zlib.gunzipSync(bytes).toString('utf-8')) as PythonBenchmarkSet
}

function inputDirectories(options: RebuildCorpusOptions): { stocks: string; benchmarks: string } {
    if (options.procrustesRoot) {
        const root = path.join(path.resolve(options.procrustesRoot), 'data', 'retrocast', '1-benchmarks')
        return { stocks: path.join(root, 'stocks'), benchmarks: path.join(root, 'definitions') }
    }
    const root = path.join(path.resolve(options.corpusRoot), 'inputs')
    return { stocks: path.join(root, 'stocks'), benchmarks: path.join(root, 'benchmarks') }
}

async function ensureModels(): Promise<Map<string, string>> {
    const result = new Map<string, string>()
    for (const config of CORPUS_MODELS) {
        const algorithm = await prisma.algorithm.upsert({
            where: { slug: config.algorithm.slug },
            update: { name: config.algorithm.name },
            create: config.algorithm,
        })
        const family = await prisma.modelFamily.upsert({
            where: { slug: config.family.slug },
            update: { name: config.family.name, algorithmId: algorithm.id },
            create: { ...config.family, algorithmId: algorithm.id },
        })
        const [versionMajor, versionMinor, versionPatch] = config.instance.version
        const instance = await prisma.modelInstance.upsert({
            where: { slug: config.instance.slug },
            update: { modelFamilyId: family.id, versionMajor, versionMinor, versionPatch },
            create: { modelFamilyId: family.id, slug: config.instance.slug, versionMajor, versionMinor, versionPatch },
        })
        result.set(config.artifactName, instance.id)
    }
    return result
}

async function ensureStocks(options: RebuildCorpusOptions): Promise<Map<string, string>> {
    const root = inputDirectories(options).stocks
    const result = new Map<string, string>()
    for (const config of CORPUS_STOCKS) {
        const filePath = path.join(root, `${config.name}.csv.gz`)
        const verified = await verifyCanonicalInput(filePath, path.join(root, `${config.name}.manifest.json`))
        const load = await loadStockFromBytes(verified.bytes, true, config.name, config.description, {
            sourcePath: `inputs/stocks/${config.name}.csv.gz`,
            sourceSha256: verified.sha256,
            schemaVersion: verified.schemaVersion,
        })
        result.set(config.name, load.stockId)
        options.onProgress?.(`stock ${config.name}: ${load.itemsCreated} new items`)
    }
    return result
}

async function ensureBenchmarks(
    options: RebuildCorpusOptions,
    stockIds: Map<string, string>
): Promise<Map<string, string>> {
    const root = inputDirectories(options).benchmarks
    const result = new Map<string, string>()
    for (const config of CORPUS_BENCHMARKS) {
        const filePath = path.join(root, `${config.name}.json.gz`)
        const verified = await verifyCanonicalInput(filePath, path.join(root, `${config.name}.manifest.json`))
        const definition = readJsonGz(verified.bytes)
        const targets = definition.targets
        if (!targets || typeof targets !== 'object' || Array.isArray(targets)) {
            throw new Error(`Benchmark ${config.name} has invalid targets`)
        }
        const expectedTargets = Object.keys(targets).length
        let benchmark = await prisma.benchmarkSet.findUnique({
            where: { name: config.name },
            include: { _count: { select: { targets: true, runs: true } } },
        })
        const expectedSource = {
            stockId: stockIds.get(config.stock)!,
            targetCount: expectedTargets,
            sourcePath: `inputs/benchmarks/${config.name}.json.gz`,
            sourceSha256: verified.sha256,
            schemaVersion: verified.schemaVersion,
            defaultConstraintsJson: JSON.stringify(definition.default_constraints),
            targetConstraintsJson: JSON.stringify(definition.constraints),
        }
        if (
            benchmark &&
            !benchmarkMatchesVerifiedSource({ ...benchmark, targetCount: benchmark._count.targets }, expectedSource)
        ) {
            if (benchmark._count.runs > 0)
                throw new Error(`Benchmark ${config.name} differs from corpus but already has runs`)
            await deleteBenchmarkAndDeps(benchmark.id)
            benchmark = null
        }
        if (!benchmark) {
            const created = await createBenchmark(
                config.name,
                typeof definition.description === 'string' ? definition.description : undefined,
                stockIds.get(config.stock)!
            )
            await loadBenchmarkData(definition, created.id, config.name)
            await prisma.benchmarkSet.update({
                where: { id: created.id },
                data: {
                    series: config.series,
                    isListed: true,
                    sourcePath: `inputs/benchmarks/${config.name}.json.gz`,
                    sourceSha256: verified.sha256,
                    schemaVersion: verified.schemaVersion,
                    defaultConstraintsJson: expectedSource.defaultConstraintsJson,
                    targetConstraintsJson: expectedSource.targetConstraintsJson,
                },
            })
            result.set(config.name, created.id)
            options.onProgress?.(`benchmark ${config.name}: ${expectedTargets} targets`)
            continue
        }
        await prisma.benchmarkSet.update({
            where: { id: benchmark.id },
            data: { series: config.series, isListed: true },
        })
        result.set(config.name, benchmark.id)
        options.onProgress?.(`benchmark ${config.name}: ${expectedTargets} targets`)
    }
    return result
}

export async function importCorpusIntoCurrentDatabase(
    options: RebuildCorpusOptions
): Promise<{ imported: number; skipped: number }> {
    const inventory = await loadCorpusInventory(options.corpusRoot)
    validateCorpusMatrix(inventory)
    if (!options.allowProvisional && inventory.publication_status !== 'release-ready') {
        throw new Error('Corpus is not release-ready; pass --allow-provisional only for local staging review')
    }
    const retrocastVersions = new Set(inventory.runs.map((run) => run.producer.retrocast_version))
    if (retrocastVersions.size !== 1) throw new Error('Corpus inventory contains multiple RetroCast versions')
    const inventorySha256 = sha256(await fs.readFile(path.join(path.resolve(options.corpusRoot), 'inventory.json')))
    const stockIds = await ensureStocks(options)
    const modelIds = await ensureModels()
    const benchmarkIds = await ensureBenchmarks(options, stockIds)
    const runs = options.limit === undefined ? inventory.runs : inventory.runs.slice(0, options.limit)
    const publicationStatus = publicationStatusForBuild(
        inventory.publication_status,
        runs.length,
        inventory.runs.length
    )
    let imported = 0
    let skipped = 0
    for (let index = 0; index < runs.length; index++) {
        const entry = runs[index]
        const key = `${entry.benchmark}/${entry.model}`
        const bundleDir = path.join(path.resolve(options.corpusRoot), 'bundles', entry.benchmark, entry.model)
        const bundle = await loadEvaluationBundleForImport(bundleDir, { verification: 'outputs' })
        if (bundle.manifestSha256 !== entry.manifest_sha256) throw new Error(`Manifest hash mismatch for ${key}`)
        const executionSources = bundle.manifest.source_files.filter(
            (source) => source.path === entry.execution_stats_path
        )
        if (executionSources.length !== 1 || executionSources[0]?.sha256 !== entry.execution_stats_sha256) {
            throw new Error(`Execution statistics evidence mismatch for ${key}`)
        }
        const rawSources = bundle.manifest.source_files.filter((source) => source.path === entry.raw_path)
        if (rawSources.length !== 1 || rawSources[0]?.sha256 !== entry.raw_sha256) {
            throw new Error(`Raw planner output evidence mismatch for ${key}`)
        }
        if (bundle.evaluation.task.name !== entry.benchmark || bundle.evaluation.metric_label !== entry.stock) {
            throw new Error(`Bundle task or stock mismatch for ${key}`)
        }
        validateFixedTierZeroEvaluation(bundle, entry.stock)
        const failureCount = Object.values(bundle.evaluation.targets).reduce(
            (sum, target) => sum + target.candidates.filter((candidate) => candidate.failure !== null).length,
            0
        )
        if (
            Object.keys(bundle.evaluation.targets).length !== entry.targets ||
            bundle.candidateCount !== entry.candidates ||
            failureCount !== entry.failures
        ) {
            throw new Error(`Verified bundle counts do not match inventory for ${key}`)
        }
        const run = await createOrUpdatePredictionRun(benchmarkIds.get(entry.benchmark)!, modelIds.get(entry.model)!, {
            retrocastVersion: bundle.manifest.retrocast_version,
            commandParams: bundle.manifest.parameters,
            executedAt: new Date(bundle.manifest.created_at),
        })
        const existing = await prisma.runEvaluation.findUnique({ where: { manifestSha256: entry.manifest_sha256 } })
        if (existing?.predictionRunId === run.id) {
            skipped++
            options.onProgress?.(`[${index + 1}/${runs.length}] verified ${key} (already imported)`)
            continue
        }
        const result = await importEvaluationBundle(run.id, bundle)
        await updatePredictionRunCost(run.id)
        if (
            result.candidates !== entry.candidates ||
            result.routes !== entry.routes ||
            result.failures !== entry.failures
        ) {
            throw new Error(`Imported counts do not match inventory for ${key}`)
        }
        imported++
        options.onProgress?.(`[${index + 1}/${runs.length}] imported ${key}: ${result.candidates} candidates`)
    }
    await prisma.databaseMetadata.upsert({
        where: { id: 'syntharena' },
        update: {
            databaseSchemaVersion: 2,
            artifactSchemaVersion: inventory.evaluation_parameters.schema_version,
            inventorySchemaVersion: inventory.schema_version,
            inventorySha256,
            retrocastVersion: [...retrocastVersions][0]!,
            publicationStatus,
            benchmarkCount: CORPUS_BENCHMARKS.length,
            modelCount: CORPUS_MODELS.length,
            expectedRunCount: inventory.matrix.expected_runs,
            importedRunCount: runs.length,
            evaluationTargetCount: runs.reduce((sum, run) => sum + run.targets, 0),
            candidateCount: runs.reduce((sum, run) => sum + run.candidates, 0),
            routeCount: runs.reduce((sum, run) => sum + run.routes, 0),
            failureCount: runs.reduce((sum, run) => sum + run.failures, 0),
            generatedAt: new Date(),
        },
        create: {
            id: 'syntharena',
            databaseSchemaVersion: 2,
            artifactSchemaVersion: inventory.evaluation_parameters.schema_version,
            inventorySchemaVersion: inventory.schema_version,
            inventorySha256,
            retrocastVersion: [...retrocastVersions][0]!,
            publicationStatus,
            benchmarkCount: CORPUS_BENCHMARKS.length,
            modelCount: CORPUS_MODELS.length,
            expectedRunCount: inventory.matrix.expected_runs,
            importedRunCount: runs.length,
            evaluationTargetCount: runs.reduce((sum, run) => sum + run.targets, 0),
            candidateCount: runs.reduce((sum, run) => sum + run.candidates, 0),
            routeCount: runs.reduce((sum, run) => sum + run.routes, 0),
            failureCount: runs.reduce((sum, run) => sum + run.failures, 0),
        },
    })
    return { imported, skipped }
}
