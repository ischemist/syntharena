import * as fs from 'fs/promises'
import * as path from 'path'
import { z } from 'zod'

import { CORPUS_BENCHMARKS, CORPUS_MODELS } from '@/lib/corpus-config'

const metricSchema = z.object({ value: z.number(), count: z.number().int().nonnegative() }).passthrough()
export const corpusPublicationStatusSchema = z.enum(['release-ready', 'staging', 'local-provisional'])
const inventoryRunSchema = z
    .object({
        run_id: z.string().min(1),
        model: z.string().min(1),
        adapter: z.string().min(1),
        benchmark: z.string().min(1),
        stock: z.string().min(1),
        bundle_path: z.string().min(1),
        execution_stats_path: z.string().min(1),
        execution_stats_sha256: z.string().regex(/^[a-f0-9]{64}$/),
        raw_path: z.string().min(1),
        raw_sha256: z.string().regex(/^[a-f0-9]{64}$/),
        status: z.literal('completed'),
        strict_manifest_verified: z.literal(true),
        manifest_sha256: z.string().regex(/^[a-f0-9]{64}$/),
        targets: z.number().int().positive(),
        expected_targets: z.number().int().positive(),
        candidates: z.number().int().nonnegative(),
        routes: z.number().int().nonnegative(),
        failures: z.number().int().nonnegative(),
        tier_0_validity_rate: metricSchema,
        solv_0_rate: metricSchema,
        solv_0_rate_key: z.string().min(1),
        producer: z.object({ retrocast_version: z.string().min(1) }).passthrough(),
    })
    .passthrough()

const inventorySchema = z
    .object({
        schema_version: z.literal('2'),
        publication_status: corpusPublicationStatusSchema,
        matrix: z.object({
            benchmarks: z.number().int().positive(),
            models: z.number().int().positive(),
            expected_runs: z.number().int().positive(),
            completed: z.number().int().nonnegative(),
            failed: z.number().int().nonnegative(),
            unavailable: z.number().int().nonnegative(),
        }),
        evaluation_parameters: z.object({
            action: z.literal('evaluate:v2'),
            schema_version: z.literal('2'),
            tiers: z.array(z.number().int().nonnegative()),
        }),
        runs: z.array(inventoryRunSchema),
    })
    .passthrough()

export type CorpusInventory = z.infer<typeof inventorySchema>
export type CorpusInventoryRun = z.infer<typeof inventoryRunSchema>

export async function loadCorpusInventory(corpusRoot: string): Promise<CorpusInventory> {
    const inventoryPath = path.join(path.resolve(corpusRoot), 'inventory.json')
    const raw = JSON.parse(await fs.readFile(inventoryPath, 'utf-8')) as unknown
    return inventorySchema.parse(raw)
}

export function validateCorpusMatrix(inventory: CorpusInventory): void {
    const expectedRuns = CORPUS_BENCHMARKS.length * CORPUS_MODELS.length
    if (
        inventory.matrix.benchmarks !== CORPUS_BENCHMARKS.length ||
        inventory.matrix.models !== CORPUS_MODELS.length ||
        inventory.matrix.expected_runs !== expectedRuns ||
        inventory.matrix.completed !== expectedRuns ||
        inventory.matrix.failed !== 0 ||
        inventory.matrix.unavailable !== 0 ||
        inventory.runs.length !== expectedRuns
    ) {
        throw new Error(
            `Corpus matrix is not the expected complete ${CORPUS_MODELS.length} x ${CORPUS_BENCHMARKS.length} set`
        )
    }
    const actual = new Map<string, CorpusInventoryRun>()
    const executionEvidence = new Set<string>()
    const rawEvidence = new Set<string>()
    for (const run of inventory.runs) {
        const key = `${run.benchmark}/${run.model}`
        if (run.run_id !== key) throw new Error(`Inventory run_id does not match benchmark/model: ${run.run_id}`)
        if (actual.has(key)) throw new Error(`Duplicate inventory run: ${key}`)
        const executionTuple = `${run.execution_stats_path}\0${run.execution_stats_sha256}`
        if (executionEvidence.has(executionTuple)) throw new Error(`Duplicate inventory execution evidence: ${key}`)
        const rawTuple = `${run.raw_path}\0${run.raw_sha256}`
        if (rawEvidence.has(rawTuple)) throw new Error(`Duplicate inventory raw evidence: ${key}`)
        if (run.targets !== run.expected_targets || run.routes + run.failures !== run.candidates) {
            throw new Error(`Inventory counts are inconsistent for ${key}`)
        }
        actual.set(key, run)
        executionEvidence.add(executionTuple)
        rawEvidence.add(rawTuple)
    }
    for (const benchmark of CORPUS_BENCHMARKS) {
        for (const model of CORPUS_MODELS) {
            const key = `${benchmark.name}/${model.artifactName}`
            const run = actual.get(key)
            if (!run) throw new Error(`Inventory is missing ${key}`)
            if (run.stock !== benchmark.stock) throw new Error(`Inventory stock mismatch for ${key}`)
            if (run.solv_0_rate_key !== `solv_0[${benchmark.stock}]_rate`) {
                throw new Error(`Inventory Solv-0 key mismatch for ${key}`)
            }
        }
    }
}
