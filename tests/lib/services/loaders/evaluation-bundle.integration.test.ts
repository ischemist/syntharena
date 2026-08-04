import { describe, expect, it } from 'vitest'

import prisma from '@/lib/db'
import {
    createOrUpdatePredictionRun,
    importEvaluationBundle,
    updatePredictionRunCost,
    validateFixedTierZeroEvaluation,
} from '@/lib/services/loaders/prediction-loader.service'

import { makeEvaluationBundle, makeTestRoute } from '../../../helpers/evaluation-bundle'
import {
    createBenchmarkSet,
    createBenchmarkTarget,
    createFullModelChain,
    createMolecule,
    createStock,
} from '../../../helpers/factories'

async function setupRun(instanceSlug: string = 'test-model') {
    let stock = await prisma.stock.findUnique({ where: { name: 'test-stock' } })
    stock ??= await createStock({ name: 'test-stock' })
    let benchmark = await prisma.benchmarkSet.findUnique({ where: { name: 'test-benchmark' } })
    if (!benchmark) {
        benchmark = await createBenchmarkSet({
            stockId: stock.id,
            name: 'test-benchmark',
            defaultConstraints: [{ kind: 'retrocast.stock_termination', stock: 'test-stock' }],
        })
        const targetA = await createMolecule({ smiles: 'CC', inchikey: 'TESTTARGETAAAAA-AAAAAAAAAA-N' })
        const targetB = await createMolecule({ smiles: 'CCC', inchikey: 'TESTTARGETBBBBB-BBBBBBBBBB-N' })
        await createBenchmarkTarget({ benchmarkSetId: benchmark.id, moleculeId: targetA.id, targetId: 'target-a' })
        await createBenchmarkTarget({ benchmarkSetId: benchmark.id, moleculeId: targetB.id, targetId: 'target-b' })
    }
    const { instance } = await createFullModelChain({ instanceSlug })
    const run = await createOrUpdatePredictionRun(benchmark.id, instance.id)
    return { stock, benchmark, run }
}

describe('importEvaluationBundle', () => {
    it('rejects failure pass evidence, undeclared tiers, and invalid acceptable-match indices', async () => {
        const { run } = await setupRun()

        const failurePass = makeEvaluationBundle()
        failurePass.evaluation.targets['target-b'].candidates[0].validity.tiers['0']!.status = 'pass'
        await expect(importEvaluationBundle(run.id, failurePass)).rejects.toThrow('contains pass evidence')

        const extraTier = makeEvaluationBundle()
        extraTier.evaluation.targets['target-a'].candidates[0].validity.tiers['1'] = {
            status: 'not_evaluated',
            checks: [],
        }
        await expect(importEvaluationBundle(run.id, extraTier)).rejects.toThrow('has tiers outside header [0]')

        const invalidMatch = makeEvaluationBundle()
        invalidMatch.evaluation.targets['target-a'].candidates[0].matches_acceptable = true
        invalidMatch.evaluation.targets['target-a'].candidates[0].matched_acceptable_index = 0
        await expect(importEvaluationBundle(run.id, invalidMatch)).rejects.toThrow('invalid acceptable route index')
    })

    it('binds task and effective constraints to the canonical benchmark definition semantically', async () => {
        const { run, benchmark } = await setupRun()
        await prisma.benchmarkSet.update({
            where: { id: benchmark.id },
            data: {
                defaultConstraintsJson: JSON.stringify([{ stock: 'test-stock', kind: 'retrocast.stock_termination' }]),
            },
        })
        await expect(importEvaluationBundle(run.id, makeEvaluationBundle())).resolves.toMatchObject({ candidates: 2 })

        const taskMismatch = makeEvaluationBundle({ manifestSha256: '9'.repeat(64) })
        taskMismatch.evaluation.task.default_constraints[0]!.stock = 'different-stock'
        for (const target of Object.values(taskMismatch.evaluation.targets)) {
            target.effective_constraints[0]!.stock = 'different-stock'
        }
        await expect(importEvaluationBundle(run.id, taskMismatch)).rejects.toThrow(
            'Evaluation task constraints differ from canonical benchmark definition'
        )

        const effectiveMismatch = makeEvaluationBundle({ manifestSha256: '8'.repeat(64) })
        effectiveMismatch.evaluation.targets['target-a'].effective_constraints.push({ kind: 'test.extra' })
        await expect(importEvaluationBundle(run.id, effectiveMismatch)).rejects.toThrow(
            'Effective constraints differ from evaluation task: target-a'
        )
    })

    it('requires the fixed Tier-0 corpus profile to be exactly Solv-0[stock]', () => {
        expect(() => validateFixedTierZeroEvaluation(makeEvaluationBundle(), 'test-stock')).not.toThrow()

        const extraConstraint = makeEvaluationBundle()
        extraConstraint.evaluation.task.default_constraints.push({ kind: 'test.extra' })
        for (const target of Object.values(extraConstraint.evaluation.targets)) {
            target.effective_constraints.push({ kind: 'test.extra' })
        }
        expect(() => validateFixedTierZeroEvaluation(extraConstraint, 'test-stock')).toThrow(
            'must have exactly one stock_termination constraint'
        )
    })

    it('rejects route and failure evidence bound to a different target', async () => {
        const { run } = await setupRun()
        const routeBundle = makeEvaluationBundle()
        routeBundle.evaluation.targets['target-a'].candidates[0].route!.target.smiles = 'C=C'
        await expect(importEvaluationBundle(run.id, routeBundle)).rejects.toThrow(
            'Candidate route root differs from enclosing target'
        )

        const failureBundle = makeEvaluationBundle()
        failureBundle.evaluation.targets['target-b'].candidates[0].failure!.target_id = 'target-a'
        await expect(importEvaluationBundle(run.id, failureBundle)).rejects.toThrow(
            'Candidate failure target differs from enclosing target'
        )
    })

    it('imports route and failure candidates with independent tier and constraint evidence', async () => {
        const { run } = await setupRun()
        const bundle = makeEvaluationBundle()

        const result = await importEvaluationBundle(run.id, bundle)

        expect(result).toEqual({ candidates: 2, routes: 1, failures: 1, metrics: 6 })
        const candidates = await prisma.predictionCandidate.findMany({
            where: { predictionRunId: run.id },
            include: { evaluations: { include: { tierResults: true } } },
            orderBy: { target: { targetId: 'asc' } },
        })
        expect(candidates[0]).toMatchObject({ routeId: expect.any(String), failureCode: null })
        expect(candidates[0].evaluations[0]).toMatchObject({
            constraintStatus: 'PASS',
            validityEvidenceJson: null,
        })
        expect(candidates[0].evaluations[0].tierResults).toEqual([expect.objectContaining({ tier: 0, status: 'PASS' })])
        expect(candidates[1]).toMatchObject({ routeId: null, failureCode: 'adapter.schema_invalid' })
        expect(candidates[1].evaluations[0]).toMatchObject({ constraintStatus: 'NOT_EVALUATED' })
        const metrics = await prisma.metricEstimate.findMany({ orderBy: [{ stratum: 'asc' }, { metricKey: 'asc' }] })
        expect(metrics.some((metric) => metric.metricKey === 'solv_0[test-stock]_mrr')).toBe(true)
        expect(metrics.some((metric) => metric.stratum === 'depth 2')).toBe(true)
        expect(metrics[0].ciLower).toBeNull()
        expect(await prisma.predictionRun.findUniqueOrThrow({ where: { id: run.id } })).toMatchObject({
            executionStatsPath: '/source/execution_stats.json.gz',
            executionStatsSha256: 'c'.repeat(64),
            timedTargets: 2,
            totalWallTime: 2,
            totalCpuTime: 1,
            meanWallTime: 1,
            meanCpuTime: 0.5,
            totalCandidates: 2,
            totalFailures: 1,
            totalRoutes: 1,
            avgRouteLength: 1,
        })
    })

    it('binds stock provenance from effective constraints, independently of the metric label', async () => {
        const { run, stock } = await setupRun()
        const bundle = makeEvaluationBundle({ metricLabel: 'test-stock+leaf' })

        await importEvaluationBundle(run.id, bundle)

        const evaluation = await prisma.runEvaluation.findFirstOrThrow({ where: { predictionRunId: run.id } })
        expect(evaluation).toMatchObject({ metricLabel: 'test-stock+leaf', stockId: stock.id })
        expect(
            await prisma.metricEstimate.findUnique({
                where: {
                    runEvaluationId_metricKey_stratum: {
                        runEvaluationId: evaluation.id,
                        metricKey: 'solv_0[test-stock+leaf]_rate',
                        stratum: '',
                    },
                },
            })
        ).not.toBeNull()
    })

    it('verifies but never overwrites canonical stock-input provenance', async () => {
        const { run, stock } = await setupRun()
        await prisma.stock.update({
            where: { id: stock.id },
            data: {
                sourcePath: 'inputs/stocks/test-stock.csv.gz',
                sourceSha256: 'b'.repeat(64),
                schemaVersion: '1.0',
            },
        })

        await importEvaluationBundle(run.id, makeEvaluationBundle())

        await expect(prisma.stock.findUniqueOrThrow({ where: { id: stock.id } })).resolves.toMatchObject({
            sourcePath: 'inputs/stocks/test-stock.csv.gz',
            sourceSha256: 'b'.repeat(64),
            schemaVersion: '1.0',
        })
    })

    it('rejects evaluation evidence from a different stock artifact', async () => {
        const { run, stock } = await setupRun()
        await prisma.stock.update({ where: { id: stock.id }, data: { sourceSha256: 'd'.repeat(64) } })

        await expect(importEvaluationBundle(run.id, makeEvaluationBundle())).rejects.toThrow(
            'Evaluation stock source differs from canonical stock input'
        )
    })

    it('leaves stock provenance null when no unique stock termination constraint exists', async () => {
        const { run, benchmark } = await setupRun()
        await prisma.benchmarkSet.update({
            where: { id: benchmark.id },
            data: { defaultConstraintsJson: '[]' },
        })

        await importEvaluationBundle(run.id, makeEvaluationBundle({ metricLabel: 'task', stockName: null }))

        expect(await prisma.runEvaluation.findFirstOrThrow({ where: { predictionRunId: run.id } })).toMatchObject({
            metricLabel: 'task',
            stockId: null,
        })
    })

    it('rejects same-count evaluation tasks whose target chemistry differs from the benchmark', async () => {
        const { run } = await setupRun()
        const bundle = makeEvaluationBundle()
        bundle.evaluation.task.targets['target-b'].smiles = 'CCCC'
        bundle.evaluation.targets['target-b'].target.smiles = 'CCCC'

        await expect(importEvaluationBundle(run.id, bundle)).rejects.toThrow(
            'Evaluation task target chemistry differs from benchmark: target-b'
        )
        await expect(prisma.runEvaluation.count({ where: { predictionRunId: run.id } })).resolves.toBe(0)
    })

    it('rejects evaluation tasks whose acceptable-route contract differs from the benchmark', async () => {
        const { run } = await setupRun()
        const bundle = makeEvaluationBundle()
        const route = makeTestRoute()
        bundle.evaluation.task.targets['target-a'].acceptable_routes.push(route)
        bundle.evaluation.targets['target-a'].target.acceptable_routes.push(route)

        await expect(importEvaluationBundle(run.id, bundle)).rejects.toThrow(
            'Evaluation task acceptable routes differ from benchmark: target-a'
        )
    })

    it('replaces one run idempotently without duplicating chemistry', async () => {
        const { run } = await setupRun()
        const bundle = makeEvaluationBundle()

        await importEvaluationBundle(run.id, bundle)
        await importEvaluationBundle(run.id, bundle)

        expect(await prisma.predictionCandidate.count({ where: { predictionRunId: run.id } })).toBe(2)
        expect(await prisma.runEvaluation.count({ where: { predictionRunId: run.id } })).toBe(1)
        expect(await prisma.route.count()).toBe(1)
        expect(await prisma.routeNode.count()).toBe(2)
    })

    it('keeps multiple metric-label evaluations over one immutable candidate set', async () => {
        const { run } = await setupRun()
        await importEvaluationBundle(run.id, makeEvaluationBundle({ manifestSha256: '4'.repeat(64) }))
        await importEvaluationBundle(
            run.id,
            makeEvaluationBundle({
                manifestSha256: '5'.repeat(64),
                metricLabel: 'test-stock+leaf',
            })
        )

        expect(await prisma.predictionCandidate.count({ where: { predictionRunId: run.id } })).toBe(2)
        expect(
            await prisma.runEvaluation.findMany({
                where: { predictionRunId: run.id },
                select: { metricLabel: true },
                orderBy: { metricLabel: 'asc' },
            })
        ).toEqual([{ metricLabel: 'test-stock' }, { metricLabel: 'test-stock+leaf' }])
    })

    it('rejects a second evaluation label when its planner candidates differ', async () => {
        const { run } = await setupRun()
        await importEvaluationBundle(run.id, makeEvaluationBundle({ manifestSha256: '6'.repeat(64) }))

        await expect(
            importEvaluationBundle(
                run.id,
                makeEvaluationBundle({
                    manifestSha256: '7'.repeat(64),
                    metricLabel: 'test-stock+depth',
                    route: makeTestRoute('different-template'),
                })
            )
        ).rejects.toThrow('candidates differ')
        expect(await prisma.runEvaluation.count({ where: { predictionRunId: run.id } })).toBe(1)
        expect(await prisma.route.count()).toBe(1)
    })

    it('rejects a second evaluation label from different planner execution evidence', async () => {
        const { run } = await setupRun()
        await importEvaluationBundle(run.id, makeEvaluationBundle({ manifestSha256: '8'.repeat(64) }))

        await expect(
            importEvaluationBundle(
                run.id,
                makeEvaluationBundle({
                    manifestSha256: '9'.repeat(64),
                    metricLabel: 'test-stock+depth',
                    executionStatsSha256: 'd'.repeat(64),
                })
            )
        ).rejects.toThrow('planner execution evidence differs')
        expect(await prisma.runEvaluation.count({ where: { predictionRunId: run.id } })).toBe(1)
    })

    it('calculates cost from planner runtime rather than RetroCast evaluation runtime', async () => {
        const { run } = await setupRun()
        await prisma.predictionRun.update({ where: { id: run.id }, data: { hourlyCost: 360 } })
        const bundle = makeEvaluationBundle()
        bundle.evaluationRun.total_seconds = 999
        await importEvaluationBundle(run.id, bundle)

        expect(await updatePredictionRunCost(run.id)).toMatchObject({ hourlyCost: 360, totalCost: 0.2 })
    })

    it('keeps identical topology with different producer provenance as distinct route artifacts', async () => {
        const first = await setupRun('model-one')
        const second = await setupRun('model-two')
        await importEvaluationBundle(first.run.id, makeEvaluationBundle({ manifestSha256: '1'.repeat(64) }))
        const secondRoute = makeTestRoute('template-b', '[CH3:1]>>[CH3:1]')
        await importEvaluationBundle(
            second.run.id,
            makeEvaluationBundle({
                manifestSha256: '2'.repeat(64),
                route: secondRoute,
            })
        )

        const routes = await prisma.route.findMany({ include: { nodes: true }, orderBy: { contentHash: 'asc' } })
        expect(routes).toHaveLength(2)
        expect(new Set(routes.map((route) => route.signature))).toHaveLength(1)
        expect(new Set(routes.map((route) => route.contentHash))).toHaveLength(2)
        const occurrenceTemplates = routes.flatMap((route) => route.nodes.map((node) => node.template).filter(Boolean))
        expect(new Set(occurrenceTemplates)).toEqual(new Set(['template-a', 'template-b']))
        expect(
            new Set(routes.flatMap((route) => route.nodes.filter((node) => !node.parentId).map((node) => node.smiles)))
        ).toEqual(new Set(['CC']))
        expect(await prisma.reactionStep.count()).toBe(1)
    })

    it('keeps parent references inside each route when bulk-importing multiple trees', async () => {
        const { run } = await setupRun()
        const bundle = makeEvaluationBundle()
        const secondRoute = makeTestRoute('template-two')
        secondRoute.target.product_of!.reactants[0] = {
            smiles: 'N',
            inchikey: 'TESTLEAFBBBBBBB-BBBBBBBBBB-N',
            annotations: {},
        }
        const secondEvaluation = structuredClone(bundle.evaluation.targets['target-a'].candidates[0])
        secondEvaluation.rank = 2
        secondEvaluation.route = secondRoute
        bundle.evaluation.targets['target-a'].candidates.push(secondEvaluation)

        await importEvaluationBundle(run.id, bundle)

        const nodes = await prisma.routeNode.findMany()
        const routeByNode = new Map(nodes.map((node) => [node.id, node.routeId]))
        for (const node of nodes) {
            if (node.parentId) expect(routeByNode.get(node.parentId)).toBe(node.routeId)
        }
        expect(await prisma.route.count()).toBe(2)
    })

    it('rolls back all candidate writes when a later evaluation constraint fails', async () => {
        const first = await setupRun('model-one')
        const second = await setupRun('model-two')
        const manifestSha256 = '3'.repeat(64)
        await importEvaluationBundle(first.run.id, makeEvaluationBundle({ manifestSha256 }))

        await expect(importEvaluationBundle(second.run.id, makeEvaluationBundle({ manifestSha256 }))).rejects.toThrow()
        expect(await prisma.predictionCandidate.count({ where: { predictionRunId: second.run.id } })).toBe(0)
        expect(await prisma.runEvaluation.count({ where: { predictionRunId: second.run.id } })).toBe(0)
    })
})
