import { describe, expect, it } from 'vitest'

import prisma from '@/lib/db'
import { createOrUpdatePredictionRun } from '@/lib/services/loaders/prediction-loader.service'

import {
    createBenchmarkSet,
    createBenchmarkTarget,
    createFullModelChain,
    createMolecule,
    createStock,
} from '../../../helpers/factories'

async function setupDatabaseBoundary() {
    const stock = await createStock({ name: 'invariant-stock' })
    const firstBenchmark = await createBenchmarkSet({ stockId: stock.id, name: 'first-benchmark' })
    const secondBenchmark = await createBenchmarkSet({ stockId: stock.id, name: 'second-benchmark' })
    const firstMolecule = await createMolecule({ smiles: 'C', inchikey: 'INVARIANTAAAAAA-AAAAAAAAAA-N' })
    const secondMolecule = await createMolecule({ smiles: 'CC', inchikey: 'INVARIANTBBBBBB-BBBBBBBBBB-N' })
    const firstTarget = await createBenchmarkTarget({
        benchmarkSetId: firstBenchmark.id,
        moleculeId: firstMolecule.id,
        targetId: 'first-target',
    })
    const secondTarget = await createBenchmarkTarget({
        benchmarkSetId: secondBenchmark.id,
        moleculeId: secondMolecule.id,
        targetId: 'second-target',
    })
    const { instance } = await createFullModelChain()
    const run = await createOrUpdatePredictionRun(firstBenchmark.id, instance.id)
    return { stock, firstBenchmark, secondBenchmark, firstTarget, secondTarget, run }
}

describe('baseline database invariants', () => {
    it('enforces one stable semantic version per model family', async () => {
        const { family, instance } = await createFullModelChain({ instanceSlug: 'stable-v1' })

        await expect(
            prisma.modelInstance.create({
                data: {
                    modelFamilyId: family.id,
                    slug: 'same-stable-version-under-another-slug',
                    versionMajor: instance.versionMajor,
                    versionMinor: instance.versionMinor,
                    versionPatch: instance.versionPatch,
                },
            })
        ).rejects.toThrow()
    })

    it('rejects candidates that contain neither or both route and failure payloads, and nonpositive ranks', async () => {
        const { firstBenchmark, firstTarget, run } = await setupDatabaseBoundary()
        const insert = (id: string, rank: number, failureCode: string | null, routeId: string | null = null) =>
            prisma.$executeRawUnsafe(
                'INSERT INTO PredictionCandidate (id, routeId, predictionRunId, targetId, benchmarkSetId, rank, failureCode) VALUES (?, ?, ?, ?, ?, ?, ?)',
                id,
                routeId,
                run.id,
                firstTarget.id,
                firstBenchmark.id,
                rank,
                failureCode
            )

        await expect(insert('missing-both', 1, null)).rejects.toThrow()
        await expect(insert('invalid-rank', 0, 'adapter.failed')).rejects.toThrow()
        const route = await prisma.route.create({
            data: { signature: 'topology', contentHash: 'artifact', length: 1, isConvergent: false },
        })
        await expect(insert('contains-both', 1, 'adapter.failed', route.id)).rejects.toThrow()
    })

    it('rejects a candidate target from a different benchmark than its run', async () => {
        const { firstBenchmark, secondTarget, run } = await setupDatabaseBoundary()
        await expect(
            prisma.$executeRawUnsafe(
                'INSERT INTO PredictionCandidate (id, routeId, predictionRunId, targetId, benchmarkSetId, rank, failureCode) VALUES (?, NULL, ?, ?, ?, 1, ?)',
                'cross-benchmark',
                run.id,
                secondTarget.id,
                firstBenchmark.id,
                'adapter.failed'
            )
        ).rejects.toThrow()
    })

    it('rejects a route node whose parent belongs to another route', async () => {
        const molecule = await createMolecule({
            smiles: 'N',
            inchikey: 'PARENTINVARIANT-AAAAAAAAAA-N',
        })
        const [firstRoute, secondRoute] = await Promise.all([
            prisma.route.create({
                data: { signature: 'first-topology', contentHash: 'first-artifact', length: 1, isConvergent: false },
            }),
            prisma.route.create({
                data: { signature: 'second-topology', contentHash: 'second-artifact', length: 1, isConvergent: false },
            }),
        ])
        const parent = await prisma.routeNode.create({
            data: { routeId: firstRoute.id, moleculeId: molecule.id, smiles: molecule.smiles },
        })

        await expect(
            prisma.routeNode.create({
                data: {
                    routeId: secondRoute.id,
                    moleculeId: molecule.id,
                    smiles: molecule.smiles,
                    parentId: parent.id,
                },
            })
        ).rejects.toThrow()
    })

    it('rejects corrupt evaluation statuses, match indices, and metric denominators', async () => {
        const { stock, firstBenchmark, firstTarget, run } = await setupDatabaseBoundary()
        const candidate = await prisma.predictionCandidate.create({
            data: {
                predictionRunId: run.id,
                targetId: firstTarget.id,
                benchmarkSetId: firstBenchmark.id,
                rank: 1,
                failureCode: 'adapter.failed',
            },
        })
        const evaluation = await prisma.runEvaluation.create({
            data: {
                predictionRunId: run.id,
                benchmarkSetId: firstBenchmark.id,
                stockId: stock.id,
                metricLabel: stock.name,
                evaluatedTiers: '[0]',
                taskJson: '{}',
                parametersJson: '{}',
                analysisJson: '{}',
                manifestJson: '{}',
                manifestSha256: 'f'.repeat(64),
                artifactSchema: '2',
                retrocastVersion: '0.8.3',
            },
        })
        const targetEvaluation = await prisma.targetEvaluation.create({
            data: {
                runEvaluationId: evaluation.id,
                predictionRunId: run.id,
                targetId: firstTarget.id,
                benchmarkSetId: firstBenchmark.id,
                effectiveConstraintsJson: '[]',
            },
        })
        const insertCandidateEvaluation = (status: string, matches: number, index: number | null) =>
            prisma.$executeRawUnsafe(
                'INSERT INTO CandidateEvaluation (id, runEvaluationId, targetEvaluationId, predictionRunId, targetId, benchmarkSetId, candidateId, constraintStatus, matchesAcceptable, matchedAcceptableIndex) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                `${status}-${matches}-${String(index)}`,
                evaluation.id,
                targetEvaluation.id,
                run.id,
                firstTarget.id,
                firstBenchmark.id,
                candidate.id,
                status,
                matches,
                index
            )

        await expect(insertCandidateEvaluation('UNKNOWN', 0, null)).rejects.toThrow()
        await expect(insertCandidateEvaluation('FAIL', 1, null)).rejects.toThrow()
        await expect(
            prisma.$executeRawUnsafe(
                'INSERT INTO MetricEstimate (id, runEvaluationId, metricKey, stratum, value, nSamples) VALUES (?, ?, ?, ?, ?, ?)',
                'negative-n',
                evaluation.id,
                'tier_0_validity_rate',
                '',
                0,
                -1
            )
        ).rejects.toThrow()
    })

    it('rejects cross-label target-evaluation wiring even when run and target match', async () => {
        const { stock, firstBenchmark, firstTarget, run } = await setupDatabaseBoundary()
        const candidate = await prisma.predictionCandidate.create({
            data: {
                predictionRunId: run.id,
                targetId: firstTarget.id,
                benchmarkSetId: firstBenchmark.id,
                rank: 1,
                failureCode: 'adapter.failed',
            },
        })
        const createEvaluation = (label: string, manifest: string) =>
            prisma.runEvaluation.create({
                data: {
                    predictionRunId: run.id,
                    benchmarkSetId: firstBenchmark.id,
                    stockId: stock.id,
                    metricLabel: label,
                    evaluatedTiers: '[0]',
                    taskJson: '{}',
                    parametersJson: '{}',
                    analysisJson: '{}',
                    manifestJson: '{}',
                    manifestSha256: manifest.repeat(64),
                    artifactSchema: '2',
                    retrocastVersion: '0.8.3',
                },
            })
        const [evaluationA, evaluationB] = await Promise.all([
            createEvaluation('label-a', 'a'),
            createEvaluation('label-b', 'b'),
        ])
        const targetEvaluationB = await prisma.targetEvaluation.create({
            data: {
                runEvaluationId: evaluationB.id,
                predictionRunId: run.id,
                targetId: firstTarget.id,
                benchmarkSetId: firstBenchmark.id,
                effectiveConstraintsJson: '[]',
            },
        })

        await expect(
            prisma.$executeRawUnsafe(
                'INSERT INTO CandidateEvaluation (id, runEvaluationId, targetEvaluationId, predictionRunId, targetId, benchmarkSetId, candidateId, constraintStatus, matchesAcceptable, matchedAcceptableIndex) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                'cross-label-evaluation',
                evaluationA.id,
                targetEvaluationB.id,
                run.id,
                firstTarget.id,
                firstBenchmark.id,
                candidate.id,
                'FAIL',
                0,
                null
            )
        ).rejects.toThrow()
    })
})
