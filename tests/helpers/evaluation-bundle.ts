import type { VerifiedEvaluationBundleForImport } from '@ischemist/retrocast-io'
import type { RetrocastFailureRecord, RetrocastRoute } from '@ischemist/routes'

const check = (status: 'pass' | 'fail' | 'not_evaluated') => ({
    code: `test.${status}`,
    status,
    message: null,
    details: {},
})

export function makeTestRoute(template: string = 'template-a', mapped: string = '[C:1]>>[C:1]'): RetrocastRoute {
    return {
        schema_version: '2',
        annotations: { producer: template },
        target: {
            smiles: 'CC',
            inchikey: 'TESTTARGETAAAAA-AAAAAAAAAA-N',
            annotations: {},
            product_of: {
                reactants: [{ smiles: 'C', inchikey: 'TESTLEAFAAAAAAA-AAAAAAAAAA-N', annotations: {} }],
                template,
                mapped_reaction_smiles: mapped,
                annotations: { producer: template },
            },
        },
    }
}

export function makeEvaluationBundle(
    options: {
        route?: RetrocastRoute
        failure?: RetrocastFailureRecord
        tier0Rate?: number
        solv0Rate?: number
        manifestSha256?: string
        metricLabel?: string
        stockName?: string | null
        executionStatsSha256?: string
    } = {}
): VerifiedEvaluationBundleForImport {
    const route = options.route ?? makeTestRoute()
    const failure = options.failure ?? {
        code: 'adapter.schema_invalid',
        message: 'invalid candidate',
        target_id: 'target-b',
        context: { adapter: 'test' },
    }
    const targetA = {
        id: 'target-a',
        smiles: route.target.smiles,
        inchikey: route.target.inchikey,
        annotations: {},
        acceptable_routes: [],
    }
    const targetB = {
        id: 'target-b',
        smiles: 'CCC',
        inchikey: 'TESTTARGETBBBBB-BBBBBBBBBB-N',
        annotations: {},
        acceptable_routes: [],
    }
    const routeCandidate = {
        rank: 1,
        route,
        failure: null,
        validity: {
            tiers: { '0': { status: 'pass' as const, checks: [] } },
            reactions: [],
        },
        constraints: { status: 'pass' as const, checks: [] },
        matches_acceptable: false,
        matched_acceptable_index: null,
    }
    const failureCandidate = {
        rank: 1,
        route: null,
        failure,
        validity: {
            tiers: { '0': { status: 'fail' as const, checks: [check('fail')] } },
            reactions: [],
        },
        constraints: { status: 'not_evaluated' as const, checks: [] },
        matches_acceptable: false,
        matched_acceptable_index: null,
    }
    const estimate = (value: number, count: number) => ({
        value,
        count,
        ci_low: null,
        ci_high: null,
        reliability: null,
    })
    const metricLabel = options.metricLabel ?? 'test-stock'
    const stockName = options.stockName === undefined ? 'test-stock' : options.stockName
    const effectiveConstraints = stockName ? [{ kind: 'retrocast.stock_termination', stock: stockName }] : []
    const task = {
        name: 'test-benchmark',
        description: 'test benchmark',
        targets: { 'target-a': targetA, 'target-b': targetB },
        default_constraints: effectiveConstraints.map((constraint) => ({ ...constraint })),
        constraints: {},
        metric_label: metricLabel,
        annotations: {},
        schema_version: '2' as const,
    }
    const tier0Rate = options.tier0Rate ?? 0.5
    const solv0Rate = options.solv0Rate ?? 0.5
    return {
        rootDir: '/test/bundle',
        manifestSha256: options.manifestSha256 ?? 'a'.repeat(64),
        verification: { policy: 'outputs', outputFiles: [], sourceFiles: [] },
        files: {
            candidates: '/test/candidates.json.gz',
            evaluation: '/test/evaluation.json.gz',
            analysis: '/test/analysis.json.gz',
            evaluationRun: '/test/evaluation-run.json',
            manifest: '/test/manifest.json',
        },
        manifest: {
            schema_version: '2',
            retrocast_version: '0.8.3',
            created_at: '2026-08-03T00:00:00.000Z',
            action: 'evaluate:v2',
            parameters: { tiers: [0] },
            directives: {},
            release_name: null,
            source_files: [
                {
                    label: 'stock',
                    path: '/source/test-stock.csv.gz',
                    sha256: 'b'.repeat(64),
                    content_hash: null,
                },
                {
                    label: 'execution_stats',
                    path: '/source/execution_stats.json.gz',
                    sha256: options.executionStatsSha256 ?? 'c'.repeat(64),
                    content_hash: null,
                },
            ],
            output_files: [],
            statistics: { targets: 2, candidates: 2 },
            summary: {},
        },
        candidateTargetCount: 2,
        candidateCount: 2,
        evaluation: {
            task,
            tiers: [0],
            metric_label: metricLabel,
            acceptable_match_level: 'full',
            acceptable_route_match: 'prefix',
            targets: {
                'target-a': {
                    target: targetA,
                    effective_constraints: effectiveConstraints.map((constraint) => ({ ...constraint })),
                    candidates: [routeCandidate],
                    wall_time: 1,
                    cpu_time: 0.5,
                },
                'target-b': {
                    target: targetB,
                    effective_constraints: effectiveConstraints.map((constraint) => ({ ...constraint })),
                    candidates: [failureCandidate],
                    wall_time: null,
                    cpu_time: null,
                },
            },
            schema_version: '2',
        },
        analysis: {
            schema_version: '2',
            metrics: {
                tier_0_validity_rate: estimate(tier0Rate, 2),
                [`solv_0[${metricLabel}]_rate`]: estimate(solv0Rate, 2),
                [`solv_0[${metricLabel}]_mrr`]: estimate(0.5, 2),
                [`acceptable_reconstruction_top_10[${metricLabel}]`]: estimate(0.25, 2),
            },
            by_stratum: {
                'depth 2': {
                    tier_0_validity_rate: estimate(1, 1),
                    [`solv_0[${metricLabel}]_rate`]: estimate(1, 1),
                },
            },
            bootstrap_resamples: null,
            runtime: {
                total_wall_time: 2,
                mean_wall_time: 1,
                total_cpu_time: 1,
                mean_cpu_time: 0.5,
                timed_target_count: 2,
            },
        },
        evaluationRun: {
            engine: 'rust',
            workers: 1,
            targets: 2,
            candidates: 2,
            ingest_seconds: 0.2,
            score_seconds: 0.5,
            analyze_seconds: 0.1,
            total_seconds: 2,
            targets_per_second: 1,
            candidates_per_second: 1,
        },
    }
}
