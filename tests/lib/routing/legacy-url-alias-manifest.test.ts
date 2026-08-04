import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

type Alias = { alias: string; reason: string }
type Manifest = {
    schema_version: number
    source: { database_sha256: string; description: string }
    benchmark_aliases: Array<Alias & { benchmark_slug: string }>
    prediction_run_aliases: Array<Alias & { benchmark_slug: string; model_instance_slug: string }>
    benchmark_target_aliases: Array<Alias & { benchmark_slug: string; target_id: string }>
}

const manifest = JSON.parse(fs.readFileSync(path.resolve('corpus/legacy-url-aliases.v1.json'), 'utf8')) as Manifest

function expectUniqueAliases(aliases: Alias[]) {
    expect(new Set(aliases.map((entry) => entry.alias)).size).toBe(aliases.length)
}

describe('legacy URL alias manifest', () => {
    it('records the complete published v0.5 URL namespace with an auditable source', () => {
        expect(manifest.schema_version).toBe(1)
        expect(manifest.source.database_sha256).toBe('01a693d1b5604256f6d3b6a4bb7b12ccce982d3050293d2512e9b35358bbdde4')
        expect(manifest.source.description).toBe(
            'Public SynthArena database dump prod-2026-05-05-v0.4.1.db.zst (decompressed)'
        )
        expect(manifest.benchmark_aliases).toHaveLength(8)
        expect(manifest.prediction_run_aliases).toHaveLength(103)
        expect(manifest.benchmark_target_aliases).toHaveLength(2594)
        expectUniqueAliases(manifest.benchmark_aliases)
        expectUniqueAliases(manifest.prediction_run_aliases)
        expectUniqueAliases(manifest.benchmark_target_aliases)
    })

    it('makes every single-ground-truth fold explicit instead of silently guessing', () => {
        const aliases = [
            ...manifest.benchmark_aliases,
            ...manifest.prediction_run_aliases,
            ...manifest.benchmark_target_aliases,
        ]
        const folds = aliases.filter((entry) => entry.reason.includes('single-gt-fold'))
        expect(folds).toHaveLength(684)
        expect(folds.every((entry) => !entry.benchmark_slug.endsWith('-single-gt'))).toBe(true)
        expect(
            manifest.prediction_run_aliases.filter((entry) => entry.reason.includes('corrected-model-version'))
        ).toHaveLength(16)
    })
})
