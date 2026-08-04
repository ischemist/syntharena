#!/usr/bin/env tsx

/**
 * Derive semantic URL aliases from one published legacy database and a rebuilt
 * canonical database. The output is no-clobber so an existing reviewed manifest
 * cannot be replaced accidentally.
 *
 * pnpm exec tsx scripts/generate-legacy-url-aliases.ts \
 *   --old /path/to/published.db \
 *   --new /path/to/staging.db \
 *   --output /path/to/legacy-url-aliases.v1.json \
 *   --source-description "Public SynthArena database dump <artifact> (decompressed)"
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

import Database from 'better-sqlite3'

type BenchmarkRow = { id: string; name: string }
type TargetRow = { id: string; benchmarkName: string; targetId: string }
type RunRow = { id: string; benchmarkName: string; modelInstanceSlug: string }

const MODEL_SLUG_CORRECTIONS: Readonly<Record<string, string>> = {
    'og-r-v1-1-0': 'og-r-v0-1-0',
    'og-rh-v1-1-0': 'og-rh-v0-1-0',
}

function benchmarkSlug(name: string): string {
    return name.endsWith('-single-gt') ? name.slice(0, -'-single-gt'.length) : name
}

function reason(benchmarkName: string, modelInstanceSlug?: string): string {
    const reasons = []
    if (benchmarkName.endsWith('-single-gt')) reasons.push('single-gt-fold')
    if (modelInstanceSlug && MODEL_SLUG_CORRECTIONS[modelInstanceSlug]) reasons.push('corrected-model-version')
    return reasons.length > 0 ? reasons.join('+') : 'identity'
}

async function sha256(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256')
    for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk as Buffer)
    return hash.digest('hex')
}

function requiredPath(value: string | undefined, name: string): string {
    if (!value) throw new Error(`--${name} is required`)
    return path.resolve(value)
}

function requiredValue(value: string | undefined, name: string): string {
    if (!value?.trim()) throw new Error(`--${name} is required`)
    return value.trim()
}

async function main() {
    const { values } = parseArgs({
        options: {
            old: { type: 'string' },
            new: { type: 'string' },
            output: { type: 'string' },
            'source-description': { type: 'string' },
        },
    })
    const oldPath = requiredPath(values.old, 'old')
    const newPath = requiredPath(values.new, 'new')
    const outputPath = requiredPath(values.output, 'output')
    const sourceDescription = requiredValue(values['source-description'], 'source-description')
    const oldDb = new Database(oldPath, { readonly: true })
    const newDb = new Database(newPath, { readonly: true })

    const oldBenchmarks = oldDb.prepare('SELECT id, name FROM BenchmarkSet ORDER BY id').all() as BenchmarkRow[]
    const newBenchmarks = new Map(
        (newDb.prepare('SELECT id, name FROM BenchmarkSet').all() as BenchmarkRow[]).map((row) => [row.name, row])
    )
    const oldTargets = oldDb
        .prepare(
            `SELECT target.id, benchmark.name AS benchmarkName, target.targetId
             FROM BenchmarkTarget target
             JOIN BenchmarkSet benchmark ON benchmark.id = target.benchmarkSetId
             ORDER BY target.id`
        )
        .all() as TargetRow[]
    const oldRuns = oldDb
        .prepare(
            `SELECT run.id, benchmark.name AS benchmarkName, instance.slug AS modelInstanceSlug
             FROM PredictionRun run
             JOIN BenchmarkSet benchmark ON benchmark.id = run.benchmarkSetId
             JOIN ModelInstance instance ON instance.id = run.modelInstanceId
             ORDER BY run.id`
        )
        .all() as RunRow[]

    const targetExists = newDb.prepare(
        `SELECT 1
         FROM BenchmarkTarget target
         JOIN BenchmarkSet benchmark ON benchmark.id = target.benchmarkSetId
         WHERE benchmark.name = ? AND target.targetId = ?`
    )
    const runExists = newDb.prepare(
        `SELECT 1
         FROM PredictionRun run
         JOIN BenchmarkSet benchmark ON benchmark.id = run.benchmarkSetId
         JOIN ModelInstance instance ON instance.id = run.modelInstanceId
         WHERE benchmark.name = ? AND instance.slug = ?`
    )

    const benchmarkAliases = oldBenchmarks.map((row) => {
        const slug = benchmarkSlug(row.name)
        if (!newBenchmarks.has(slug)) throw new Error(`No destination benchmark for ${row.name}`)
        return { alias: row.id, benchmark_slug: slug, reason: reason(row.name) }
    })
    const benchmarkTargetAliases = oldTargets.map((row) => {
        const slug = benchmarkSlug(row.benchmarkName)
        if (!targetExists.get(slug, row.targetId)) {
            throw new Error(`No destination target for ${row.benchmarkName}/${row.targetId}`)
        }
        return {
            alias: row.id,
            benchmark_slug: slug,
            target_id: row.targetId,
            reason: reason(row.benchmarkName),
        }
    })
    const predictionRunAliases = oldRuns.map((row) => {
        const slug = benchmarkSlug(row.benchmarkName)
        const modelSlug = MODEL_SLUG_CORRECTIONS[row.modelInstanceSlug] ?? row.modelInstanceSlug
        if (!runExists.get(slug, modelSlug)) {
            throw new Error(`No destination run for ${row.benchmarkName}/${row.modelInstanceSlug}`)
        }
        return {
            alias: row.id,
            benchmark_slug: slug,
            model_instance_slug: modelSlug,
            reason: reason(row.benchmarkName, row.modelInstanceSlug),
        }
    })

    const manifest = {
        schema_version: 1,
        source: {
            database_sha256: await sha256(oldPath),
            description: sourceDescription,
        },
        benchmark_aliases: benchmarkAliases,
        prediction_run_aliases: predictionRunAliases,
        benchmark_target_aliases: benchmarkTargetAliases,
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
    console.log(
        `Wrote ${benchmarkAliases.length} benchmark, ${predictionRunAliases.length} run, and ${benchmarkTargetAliases.length} target aliases to ${outputPath}`
    )
}

void main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
})
