import { describe, expect, it } from 'vitest'

import { CORPUS_BENCHMARKS, CORPUS_MODELS } from '@/lib/corpus-config'
import type { CorpusInventory } from '@/lib/corpus-inventory'
import { corpusPublicationStatusSchema, validateCorpusMatrix } from '@/lib/corpus-inventory'
import {
    benchmarkMatchesVerifiedSource,
    publicationStatusForBuild,
} from '@/lib/services/loaders/corpus-rebuild.service'

function completeInventory(): CorpusInventory {
    const runs = CORPUS_BENCHMARKS.flatMap((benchmark) =>
        CORPUS_MODELS.map((model) => ({
            run_id: `${benchmark.name}/${model.artifactName}`,
            model: model.artifactName,
            adapter: 'test',
            benchmark: benchmark.name,
            stock: benchmark.stock,
            bundle_path: `/ignored/${benchmark.name}/${model.artifactName}`,
            execution_stats_path: `/ignored/${benchmark.name}/${model.artifactName}/execution_stats.json.gz`,
            execution_stats_sha256: `${benchmark.name}/${model.artifactName}`
                .padEnd(64, 'a')
                .slice(0, 64)
                .replace(/[^a-f0-9]/g, 'a'),
            raw_path: `/ignored/${benchmark.name}/${model.artifactName}/results.json.gz`,
            raw_sha256: 'b'.repeat(64),
            status: 'completed' as const,
            strict_manifest_verified: true as const,
            manifest_sha256: 'a'.repeat(64),
            targets: 10,
            expected_targets: 10,
            candidates: 2,
            routes: 1,
            failures: 1,
            tier_0_validity_rate: { value: 0.5, count: 10 },
            solv_0_rate: { value: 0.5, count: 10 },
            solv_0_rate_key: `solv_0[${benchmark.stock}]_rate`,
            producer: { retrocast_version: '0.8.3' },
        }))
    )
    return {
        schema_version: '2',
        publication_status: 'release-ready',
        matrix: {
            benchmarks: CORPUS_BENCHMARKS.length,
            models: CORPUS_MODELS.length,
            expected_runs: runs.length,
            completed: runs.length,
            failed: 0,
            unavailable: 0,
        },
        evaluation_parameters: { action: 'evaluate:v2', schema_version: '2', tiers: [0] },
        runs,
    }
}

describe('declarative corpus matrix', () => {
    it('defines the complete six-by-fourteen rebuild and validates it', () => {
        expect(CORPUS_BENCHMARKS).toHaveLength(6)
        expect(CORPUS_MODELS).toHaveLength(14)
        expect(() => validateCorpusMatrix(completeInventory())).not.toThrow()
    })

    it('rejects missing and duplicate matrix entries before any database writes', () => {
        const missing = completeInventory()
        missing.runs.pop()
        expect(() => validateCorpusMatrix(missing)).toThrow('complete 14 x 6')

        const duplicate = completeInventory()
        duplicate.runs[1] = duplicate.runs[0]
        expect(() => validateCorpusMatrix(duplicate)).toThrow('Duplicate inventory run')
    })

    it('uses the verified Retro* runtime version instead of legacy database labels', () => {
        const retro = CORPUS_MODELS.find((model) => model.artifactName === 'retro-star')
        expect(retro?.instance).toEqual({ slug: 'og-r-v0-1-0', version: [0, 1, 0] })
    })

    it('accepts only explicit publication states and downgrades subset builds', () => {
        expect(corpusPublicationStatusSchema.safeParse('release-ready').success).toBe(true)
        expect(corpusPublicationStatusSchema.safeParse('official staging prose').success).toBe(false)
        expect(publicationStatusForBuild('release-ready', 83, 84)).toBe('local-provisional')
        expect(publicationStatusForBuild('staging', 84, 84)).toBe('staging')
    })

    it('requires exact benchmark source identity before reusing persisted targets', () => {
        const persisted = {
            stockId: 'stock',
            targetCount: 500,
            sourcePath: 'inputs/benchmarks/mkt-lin-500.json.gz',
            sourceSha256: 'a'.repeat(64),
            schemaVersion: '2',
            defaultConstraintsJson: '[]',
            targetConstraintsJson: '{}',
        }
        expect(benchmarkMatchesVerifiedSource(persisted, persisted)).toBe(true)
        expect(
            benchmarkMatchesVerifiedSource(persisted, {
                ...persisted,
                sourceSha256: 'b'.repeat(64),
            })
        ).toBe(false)
    })
})
