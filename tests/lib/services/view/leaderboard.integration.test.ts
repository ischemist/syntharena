import { describe, expect, it, vi } from 'vitest'

import prisma from '@/lib/db'
import { findStatisticsForLeaderboard } from '@/lib/services/data/stats.data'
import { getLeaderboardPageData } from '@/lib/services/view/leaderboard.view'

import { makeEvaluationBundle } from '../../../helpers/evaluation-bundle'
import {
    createBenchmarkSet,
    createBenchmarkTarget,
    createFullModelChain,
    createMolecule,
    createStock,
} from '../../../helpers/factories'

const cacheWrappedFunctions = vi.hoisted(() => [] as string[])

async function createOrUpdatePredictionRun(benchmarkSetId: string, modelInstanceId: string) {
    return prisma.predictionRun.create({ data: { benchmarkSetId, modelInstanceId } })
}

async function importEvaluationBundle(runId: string, bundle: ReturnType<typeof makeEvaluationBundle>) {
    const run = await prisma.predictionRun.findUniqueOrThrow({
        where: { id: runId },
        include: { benchmarkSet: true },
    })
    const evaluation = await prisma.runEvaluation.create({
        data: {
            predictionRunId: run.id,
            benchmarkSetId: run.benchmarkSetId,
            stockId: run.benchmarkSet.stockId,
            metricLabel: bundle.evaluation.metric_label,
            evaluatedTiers: JSON.stringify(bundle.evaluation.tiers),
            taskJson: JSON.stringify(bundle.evaluation.task),
            parametersJson: JSON.stringify(bundle.manifest.parameters),
            analysisJson: JSON.stringify(bundle.analysis),
            manifestJson: JSON.stringify(bundle.manifest),
            manifestSha256: bundle.manifestSha256,
            artifactSchema: bundle.manifest.schema_version,
            retrocastVersion: bundle.manifest.retrocast_version,
        },
    })
    const metrics = [
        ...Object.entries(bundle.analysis.metrics).map(([metricKey, metric]) => ({ metricKey, stratum: '', metric })),
        ...Object.entries(bundle.analysis.by_stratum).flatMap(([stratum, values]) =>
            Object.entries(values).map(([metricKey, metric]) => ({ metricKey, stratum, metric }))
        ),
    ]
    await prisma.metricEstimate.createMany({
        data: metrics.map(({ metricKey, stratum, metric }) => ({
            runEvaluationId: evaluation.id,
            metricKey,
            stratum,
            value: metric.value,
            ciLower: metric.ci_low,
            ciUpper: metric.ci_high,
            nSamples: metric.count,
            reliabilityCode: null,
            reliabilityMessage: null,
        })),
    })
    return evaluation
}

vi.mock('next/cache', () => ({
    unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => {
        cacheWrappedFunctions.push(fn.name)
        return fn
    },
    revalidateTag: vi.fn(),
    revalidatePath: vi.fn(),
}))

async function setupBenchmark(name: string = 'test-benchmark') {
    const stock = await createStock({ name: 'test-stock' })
    const benchmark = await createBenchmarkSet({
        stockId: stock.id,
        name,
        defaultConstraints: [{ kind: 'retrocast.stock_termination', stock: stock.name }],
    })
    await prisma.benchmarkSet.update({ where: { id: benchmark.id }, data: { hasAcceptableRoutes: true } })
    const targetA = await createMolecule({ smiles: 'CC', inchikey: 'TESTTARGETAAAAA-AAAAAAAAAA-N' })
    const targetB = await createMolecule({ smiles: 'CCC', inchikey: 'TESTTARGETBBBBB-BBBBBBBBBB-N' })
    await createBenchmarkTarget({ benchmarkSetId: benchmark.id, moleculeId: targetA.id, targetId: 'target-a' })
    await createBenchmarkTarget({ benchmarkSetId: benchmark.id, moleculeId: targetB.id, targetId: 'target-b' })
    return { stock, benchmark }
}

function withTopK(bundle: ReturnType<typeof makeEvaluationBundle>, top1: number, top10: number) {
    bundle.analysis.metrics[`acceptable_reconstruction_top_1[${bundle.evaluation.metric_label}]`] = {
        value: top1,
        count: 2,
        ci_low: null,
        ci_high: null,
        reliability: null,
    }
    bundle.analysis.metrics[`acceptable_reconstruction_top_10[${bundle.evaluation.metric_label}]`] = {
        value: top10,
        count: 2,
        ci_low: null,
        ci_high: null,
        reliability: null,
    }
    return bundle
}

describe('getLeaderboardPageData', () => {
    it('keeps artifact, constraint, and unrelated metric data out of the leaderboard query', async () => {
        expect(cacheWrappedFunctions).not.toContain('findStatisticsForLeaderboard')
        expect(cacheWrappedFunctions).not.toContain('_findStatisticsForLeaderboard')

        const { benchmark } = await setupBenchmark()
        const { instance } = await createFullModelChain({ instanceSlug: 'lean-leaderboard-model' })
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)
        await importEvaluationBundle(run.id, makeEvaluationBundle())
        const evaluation = await prisma.runEvaluation.findFirstOrThrow({ where: { predictionRunId: run.id } })

        // One stored artifact blob alone is larger than Next.js' 2 MiB cache-item limit.
        await prisma.runEvaluation.update({
            where: { id: evaluation.id },
            data: { analysisJson: 'x'.repeat(2_100_000) },
        })
        await prisma.benchmarkSet.update({
            where: { id: benchmark.id },
            data: { targetConstraintsJson: JSON.stringify({ 'target-a': ['large constraint payload'] }) },
        })

        const rows = await findStatisticsForLeaderboard({ id: evaluation.id })

        expect(rows).toHaveLength(1)
        expect(rows[0]).not.toHaveProperty('analysisJson')
        expect(rows[0]).not.toHaveProperty('manifestJson')
        expect(rows[0].predictionRun.benchmarkSet).not.toHaveProperty('targetConstraintsJson')
        expect(rows[0].metrics.map((metric) => metric.metricKey)).not.toContain('solv_0[test-stock]_mrr')
        expect(rows[0].metrics.map((metric) => metric.metricKey)).toContain(
            'acceptable_reconstruction_top_10[test-stock]'
        )
        expect(Buffer.byteLength(JSON.stringify(rows))).toBeLessThan(100_000)
    })

    it('returns null without listed benchmarks and an empty DTO without evaluations', async () => {
        expect(await getLeaderboardPageData()).toBeNull()

        const stock = await createStock({ name: 'empty-stock' })
        const benchmark = await createBenchmarkSet({ stockId: stock.id, name: 'empty-benchmark' })
        const result = await getLeaderboardPageData(benchmark.id)
        expect(result).toMatchObject({
            leaderboardEntries: [],
            metricLabels: [],
            metadata: { availableTopKMetrics: [] },
        })
    })

    it('orders listed benchmarks and falls back from an invalid filter to the first one', async () => {
        const stock = await createStock({ name: 'filter-stock' })
        await createBenchmarkSet({ stockId: stock.id, name: 'z-benchmark' })
        const first = await createBenchmarkSet({ stockId: stock.id, name: 'a-benchmark' })

        const result = await getLeaderboardPageData('not-a-benchmark')
        expect(result?.allBenchmarks.map((benchmark) => benchmark.name)).toEqual(['a-benchmark', 'z-benchmark'])
        expect(result?.selectedBenchmark.id).toBe(first.id)

        const selectedBySlug = await getLeaderboardPageData(first.slug)
        expect(selectedBySlug?.selectedBenchmark.id).toBe(first.id)
    })

    it('composes multi-instance and multi-label evaluations with exact strata and Top-K ordering', async () => {
        const { benchmark, stock } = await setupBenchmark()
        const { family, instance: firstInstance } = await createFullModelChain({
            algorithmName: 'leaderboard-algorithm',
            familyName: 'Leaderboard family',
            instanceSlug: 'leaderboard-v1',
        })
        const secondInstance = await prisma.modelInstance.create({
            data: {
                modelFamilyId: family.id,
                slug: 'leaderboard-v2',
                versionMajor: 2,
                versionMinor: 0,
                versionPatch: 0,
            },
        })
        const firstRun = await createOrUpdatePredictionRun(benchmark.id, firstInstance.id)
        const secondRun = await createOrUpdatePredictionRun(benchmark.id, secondInstance.id)

        await importEvaluationBundle(
            firstRun.id,
            withTopK(makeEvaluationBundle({ manifestSha256: '1'.repeat(64) }), 0.4, 0.9)
        )
        await importEvaluationBundle(
            firstRun.id,
            withTopK(
                makeEvaluationBundle({
                    manifestSha256: '2'.repeat(64),
                    metricLabel: 'test-stock+leaf',
                }),
                0.3,
                0.7
            )
        )
        await importEvaluationBundle(
            secondRun.id,
            withTopK(makeEvaluationBundle({ manifestSha256: '3'.repeat(64) }), 0.5, 0.5)
        )

        const curated = await getLeaderboardPageData(benchmark.id)
        expect(curated?.metadata.availableTopKMetrics).toEqual(['Top-1', 'Top-10'])
        expect(curated?.leaderboardEntries).toHaveLength(2)
        expect(new Set(curated?.leaderboardEntries.map((entry) => entry.metrics.solv0Label))).toEqual(
            new Set(['test-stock', 'test-stock+leaf'])
        )
        expect(curated?.leaderboardEntries.find((entry) => entry.metrics.solv0Label === 'test-stock')?.runId).toBe(
            firstRun.id
        )
        expect(curated?.metricLabels).toEqual([
            { id: 'test-stock', label: 'test-stock', stockName: stock.name },
            { id: 'test-stock+leaf', label: 'test-stock+leaf', stockName: stock.name },
        ])
        expect(
            curated?.stratifiedMetricsByLabel.get('test-stock')?.get('Leaderboard family')?.solv0.byStratum['depth 2']
                .value
        ).toBe(1)

        const developer = await getLeaderboardPageData(benchmark.id, true)
        expect(developer?.leaderboardEntries).toHaveLength(3)
        expect(developer?.leaderboardEntries.filter((entry) => entry.metrics.solv0Label === 'test-stock')).toHaveLength(
            2
        )
    })

    it('fails closed when a stored evaluation lacks a required headline metric', async () => {
        const { benchmark } = await setupBenchmark()
        const { instance } = await createFullModelChain({ instanceSlug: 'missing-metric-model' })
        const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)
        await importEvaluationBundle(run.id, makeEvaluationBundle())
        await prisma.metricEstimate.deleteMany({ where: { metricKey: 'tier_0_validity_rate' } })

        await expect(getLeaderboardPageData(benchmark.id)).rejects.toThrow('missing Tier-0 or Solv-0')
    })
})
