import { describe, expect, it } from 'vitest'

import { _buildLeaderboardRunHref } from '@/app/leaderboard/_components/client/leaderboard-columns'
import { displaySolvStatus } from '@/lib/retrocast-metrics'
import type { RawStatsPayload } from '@/lib/services/view/leaderboard.view'
import { _curateChampionStats, _transformStatsToLeaderboardDTOs } from '@/lib/services/view/leaderboard.view'

function metric(metricKey: string, value: number, stratum: string = '') {
    return {
        id: `${metricKey}-${stratum}`,
        runEvaluationId: 'evaluation',
        metricKey,
        stratum,
        value,
        ciLower: null,
        ciUpper: null,
        nSamples: 10,
        reliabilityCode: null,
        reliabilityMessage: null,
    }
}

function stat(
    runId: string,
    versionPatch: number,
    metrics: ReturnType<typeof metric>[],
    familyId: string = 'family',
    metricLabel: string = 'test-stock'
): RawStatsPayload[number] {
    return {
        id: `evaluation-${runId}`,
        predictionRunId: runId,
        benchmarkSetId: 'benchmark',
        stockId: 'stock',
        metricLabel,
        evaluatedTiers: '[0]',
        taskJson: '{}',
        parametersJson: '{}',
        analysisJson: '{}',
        manifestJson: '{}',
        manifestSha256: runId.padEnd(64, '0'),
        artifactSchema: '2',
        retrocastVersion: '0.8.3',
        createdAt: new Date(),
        stock: {
            id: 'stock',
            name: 'test-stock',
            description: null,
            sourcePath: null,
            sourceSha256: null,
            schemaVersion: null,
        },
        predictionRun: {
            id: runId,
            modelInstanceId: `instance-${runId}`,
            benchmarkSetId: 'benchmark',
            retrocastVersion: '0.8.3',
            commandParams: null,
            executedAt: new Date(),
            hourlyCost: null,
            totalCost: null,
            executionStatsPath: '/source/execution_stats.json.gz',
            executionStatsSha256: 'a'.repeat(64),
            timedTargets: 10,
            totalWallTime: 1,
            totalCpuTime: 1,
            meanWallTime: 0.1,
            meanCpuTime: 0.1,
            totalCandidates: 10,
            totalFailures: 0,
            totalRoutes: 10,
            avgRouteLength: 2,
            submissionType: 'MAINTAINER_VERIFIED',
            isRetrained: null,
            benchmarkSet: {
                id: 'benchmark',
                name: 'test-benchmark',
                description: null,
                stockId: 'stock',
                hasAcceptableRoutes: true,
                sourcePath: null,
                sourceSha256: null,
                schemaVersion: null,
                createdAt: new Date(),
                series: 'MARKET',
                isListed: true,
            },
            modelInstance: {
                id: `instance-${runId}`,
                modelFamilyId: familyId,
                slug: `model-${runId}`,
                description: null,
                versionMajor: 1,
                versionMinor: 0,
                versionPatch,
                versionPrerelease: '',
                metadata: null,
                createdAt: new Date(),
                family: {
                    id: familyId,
                    algorithmId: 'algorithm',
                    name: 'Test family',
                    slug: 'test-family',
                    description: null,
                    algorithm: {
                        id: 'algorithm',
                        name: 'Test algorithm',
                        slug: 'test-algorithm',
                        description: null,
                        paper: null,
                        codeUrl: null,
                        bibtex: null,
                    },
                },
            },
        },
        metrics,
    } as RawStatsPayload[number]
}

describe('Solv-N leaderboard projection', () => {
    it('selects family champions by Top-10, falling back to exact-label Solv-0', () => {
        const topKWinner = stat('top-k-winner', 1, [
            metric('tier_0_validity_rate', 0.7),
            metric('solv_0[test-stock]_rate', 0.5),
            metric('acceptable_reconstruction_top_10[test-stock]', 0.9),
        ])
        const solvWinner = stat('solv-winner', 2, [
            metric('tier_0_validity_rate', 0.9),
            metric('solv_0[test-stock]_rate', 0.95),
            metric('acceptable_reconstruction_top_10[test-stock]', 0.4),
        ])
        expect(_curateChampionStats([topKWinner, solvWinner])[0].predictionRun.id).toBe('top-k-winner')

        topKWinner.metrics = topKWinner.metrics.filter((row) => !row.metricKey.includes('acceptable_reconstruction'))
        solvWinner.metrics = solvWinner.metrics.filter((row) => !row.metricKey.includes('acceptable_reconstruction'))
        expect(_curateChampionStats([topKWinner, solvWinner])[0].predictionRun.id).toBe('solv-winner')
    })

    it('curates a separate champion for each exact Solv-0 label', () => {
        const stockOnly = stat(
            'stock-only',
            1,
            [metric('tier_0_validity_rate', 0.8), metric('solv_0[test-stock]_rate', 0.7)],
            'family',
            'test-stock'
        )
        const stockAndLeaf = stat(
            'stock-and-leaf',
            2,
            [metric('tier_0_validity_rate', 0.8), metric('solv_0[test-stock+leaf]_rate', 0.6)],
            'family',
            'test-stock+leaf'
        )

        expect(_curateChampionStats([stockOnly, stockAndLeaf]).map((row) => row.metricLabel)).toEqual([
            'test-stock',
            'test-stock+leaf',
        ])

        const entries = _transformStatsToLeaderboardDTOs([stockOnly, stockAndLeaf], false, []).leaderboardEntries
        expect(
            Object.fromEntries(
                entries.map((entry) => [entry.metrics.solv0Label, _buildLeaderboardRunHref(entry, false)])
            )
        ).toEqual({
            'test-stock': '/runs/stock-only?evaluation=evaluation-stock-only&layout=side-by-side',
            'test-stock+leaf': '/runs/stock-and-leaf?evaluation=evaluation-stock-and-leaf&layout=side-by-side',
        })
    })

    it('projects separate Tier-0 and Solv-0 metrics while preserving raw strata', () => {
        const raw = stat('run', 1, [
            metric('tier_0_validity_rate', 0.8),
            metric('tier_0_validity_rate', 1, 'depth 2'),
            metric('solv_0[test-stock]_rate', 0.6),
            metric('solv_0[test-stock]_rate', 0.75, 'depth 2'),
        ])
        const result = _transformStatsToLeaderboardDTOs([raw], false, [])

        expect(result.leaderboardEntries[0].metrics).toMatchObject({
            tier0Validity: {
                value: 0.8,
                reliability: {
                    code: 'LOW_N',
                    message: 'RetroCast did not report reliability for this metric.',
                },
            },
            solv0: { value: 0.6 },
            solv0Label: 'test-stock',
        })
        const projected = result.stratifiedMetricsByLabel.get('test-stock')?.get('Test family')
        expect(projected?.tier0Validity.byStratum['depth 2'].value).toBe(1)
        expect(projected?.solv0.byStratum['depth 2'].value).toBe(0.75)
    })

    it('uses the exact metric label when stock provenance is absent', () => {
        const raw = stat('run', 1, [metric('tier_0_validity_rate', 0.8), metric('solv_0[test-stock+depth]_rate', 0.6)])
        raw.metricLabel = 'test-stock+depth'
        raw.stock = null

        const result = _transformStatsToLeaderboardDTOs([raw], false, [])

        expect(result.leaderboardEntries[0]).toMatchObject({
            stockName: 'test-stock+depth',
            metrics: { solv0Label: 'test-stock+depth' },
        })
        expect(result.stratifiedMetricsByLabel.has('test-stock+depth')).toBe(true)
        expect(result.metricLabels).toEqual([{ id: 'test-stock+depth', label: 'test-stock+depth' }])
    })

    it('treats a missing Tier-0 metric as unavailable rather than zero', () => {
        const raw = stat('run', 1, [metric('solv_0[test-stock]_rate', 0.6)])
        expect(() => _transformStatsToLeaderboardDTOs([raw], false, [])).toThrow('missing Tier-0 or Solv-0')
    })

    it('labels constraint results by their exact task rather than implying stock termination', () => {
        expect(displaySolvStatus(0, 'task', true)).toBe('Solv-0[task] pass')
        expect(displaySolvStatus(0, 'custom:catalog+leaf', false)).toBe('Solv-0[custom:catalog+leaf] fail')
    })
})
