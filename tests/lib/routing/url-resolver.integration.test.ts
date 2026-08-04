import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import prisma from '@/lib/db'
import {
    resolveBenchmarkTargetUrlKey,
    resolveBenchmarkUrlKey,
    resolvePredictionRunUrlKey,
    resolveRunRoute,
    resolveTargetComparisonRoute,
} from '@/lib/routing/url-resolver'
import { proxy } from '@/proxy'

import {
    createBenchmarkSet,
    createBenchmarkTarget,
    createFullModelChain,
    createMolecule,
    createStock,
} from '../../helpers/factories'

describe('public URL resolution', () => {
    it('canonicalizes benchmark, target, run, and supported legacy query identifiers in one hop', async () => {
        const stock = await createStock({ name: 'url-resolution-stock' })
        const firstBenchmark = await createBenchmarkSet({
            stockId: stock.id,
            name: 'URL resolution benchmark',
            slug: 'url-resolution-benchmark',
        })
        const secondBenchmark = await createBenchmarkSet({
            stockId: stock.id,
            name: 'Other URL benchmark',
            slug: 'other-url-benchmark',
        })
        const molecule = await createMolecule({
            smiles: 'CCO',
            inchikey: 'URLRESOLUTIONAAA-BBBBBBBBBB-C',
        })
        const firstTarget = await createBenchmarkTarget({
            benchmarkSetId: firstBenchmark.id,
            moleculeId: molecule.id,
            targetId: 'target with spaces',
        })
        const secondTarget = await createBenchmarkTarget({
            benchmarkSetId: secondBenchmark.id,
            moleculeId: molecule.id,
            targetId: 'other-target',
        })
        const { instance } = await createFullModelChain({ instanceSlug: 'url-model-v1' })
        const firstRun = await prisma.predictionRun.create({
            data: { id: 'sa_url_run_first', benchmarkSetId: firstBenchmark.id, modelInstanceId: instance.id },
        })
        const secondRun = await prisma.predictionRun.create({
            data: { id: 'sa_url_run_second', benchmarkSetId: secondBenchmark.id, modelInstanceId: instance.id },
        })

        await prisma.benchmarkUrlAlias.create({
            data: { alias: 'legacy-benchmark', benchmarkSetId: firstBenchmark.id, reason: 'identity' },
        })
        await prisma.benchmarkUrlAlias.create({
            data: { alias: firstBenchmark.slug, benchmarkSetId: secondBenchmark.id, reason: 'collision-test' },
        })
        await prisma.benchmarkTargetUrlAlias.createMany({
            data: [
                { alias: 'legacy-target', benchmarkTargetId: firstTarget.id, reason: 'identity' },
                { alias: 'other-legacy-target', benchmarkTargetId: secondTarget.id, reason: 'identity' },
                { alias: firstTarget.id, benchmarkTargetId: secondTarget.id, reason: 'collision-test' },
            ],
        })
        await prisma.predictionRunUrlAlias.createMany({
            data: [
                { alias: 'legacy-run', predictionRunId: firstRun.id, reason: 'identity' },
                { alias: 'other-legacy-run', predictionRunId: secondRun.id, reason: 'identity' },
                { alias: firstRun.id, predictionRunId: secondRun.id, reason: 'collision-test' },
            ],
        })

        await expect(resolveBenchmarkUrlKey(firstBenchmark.slug)).resolves.toMatchObject({ id: firstBenchmark.id })
        await expect(resolveBenchmarkUrlKey(firstBenchmark.id)).resolves.toMatchObject({ slug: firstBenchmark.slug })
        await expect(resolveBenchmarkUrlKey('legacy-benchmark')).resolves.toMatchObject({ id: firstBenchmark.id })
        await expect(resolvePredictionRunUrlKey('legacy-run')).resolves.toMatchObject({ id: firstRun.id })
        await expect(resolveBenchmarkTargetUrlKey(firstBenchmark.id, 'legacy-target')).resolves.toMatchObject({
            id: firstTarget.id,
        })
        await expect(resolveBenchmarkTargetUrlKey(firstBenchmark.id, firstTarget.id)).resolves.toMatchObject({
            id: firstTarget.id,
        })
        await expect(resolvePredictionRunUrlKey(firstRun.id)).resolves.toMatchObject({ id: firstRun.id })
        await expect(resolveBenchmarkTargetUrlKey(secondBenchmark.id, 'legacy-target')).resolves.toBeNull()

        const targetRoute = await resolveTargetComparisonRoute('legacy-benchmark', 'legacy-target', {
            mode: 'pred-vs-pred',
            model1: 'legacy-run',
            model2: 'other-legacy-run',
            rank1: '2',
        })
        expect(targetRoute).toMatchObject({
            needsRedirect: true,
            benchmark: { id: firstBenchmark.id },
            target: { id: firstTarget.id },
        })
        expect(targetRoute?.canonicalUrl).toBe(
            `/benchmarks/url-resolution-benchmark/targets/${firstTarget.id}?mode=pred-vs-pred&model1=sa_url_run_first&model2=other-legacy-run&rank1=2`
        )

        const runRoute = await resolveRunRoute('legacy-run', {
            target: 'legacy-target',
            stock: 'legacy-stock',
            search: 'target label',
            rank: '3',
        })
        expect(runRoute?.needsRedirect).toBe(true)
        expect(runRoute?.canonicalUrl).toBe(`/runs/${firstRun.id}?target=${firstTarget.id}&search=target+label&rank=3`)

        const canonicalRoute = await resolveTargetComparisonRoute(firstBenchmark.slug, firstTarget.id, {
            model1: firstRun.id,
        })
        expect(canonicalRoute?.needsRedirect).toBe(false)
        expect(canonicalRoute?.canonicalUrl).toBe(
            `/benchmarks/url-resolution-benchmark/targets/${firstTarget.id}?model1=sa_url_run_first`
        )

        const redirect = await proxy(
            new NextRequest(
                'https://syntharena.ischemist.com/benchmarks/legacy-benchmark/targets/legacy-target?mode=pred-vs-pred&model1=legacy-run'
            )
        )
        expect(redirect.status).toBe(308)
        expect(redirect.headers.get('location')).toBe(
            `https://syntharena.ischemist.com/benchmarks/url-resolution-benchmark/targets/${firstTarget.id}?mode=pred-vs-pred&model1=sa_url_run_first`
        )

        for (const benchmarkKey of ['legacy-benchmark', firstBenchmark.id]) {
            const leaderboardRedirect = await proxy(
                new NextRequest(
                    `https://syntharena.ischemist.com/leaderboard?benchmarkId=${benchmarkKey}&dev=true&topK=Top-10`
                )
            )
            expect(leaderboardRedirect.status).toBe(308)
            expect(leaderboardRedirect.headers.get('location')).toBe(
                'https://syntharena.ischemist.com/leaderboard?benchmarkId=url-resolution-benchmark&dev=true&topK=Top-10'
            )
        }
        const canonicalLeaderboard = await proxy(
            new NextRequest(
                'https://syntharena.ischemist.com/leaderboard?benchmarkId=url-resolution-benchmark&dev=true'
            )
        )
        expect(canonicalLeaderboard.status).toBe(200)
        expect(canonicalLeaderboard.headers.has('location')).toBe(false)
    })

    it('fails closed for unknown public identifiers', async () => {
        await expect(resolveBenchmarkUrlKey('missing-benchmark')).resolves.toBeNull()
        await expect(resolvePredictionRunUrlKey('missing-run')).resolves.toBeNull()
        await expect(resolveRunRoute('missing-run', {})).resolves.toBeNull()
        await expect(resolveTargetComparisonRoute('missing-benchmark', 'missing-target', {})).resolves.toBeNull()
    })
})
