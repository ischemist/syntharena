/**
 * Unit tests for pure transformation functions in leaderboard.view.ts
 *
 * Tests _curateChampionStats (champion selection per model family) and
 * _transformStatsToLeaderboardDTOs (raw stats -> leaderboard DTOs).
 * These are pure functions — no database, no mocking.
 */

import { describe, expect, it } from 'vitest'

import { _curateChampionStats, _transformStatsToLeaderboardDTOs } from '@/lib/services/view/leaderboard.view'

import { makeRawMetric, makeRawStatEntry } from '../../../helpers/factories'

// ============================================================================
// _curateChampionStats
// ============================================================================

describe('_curateChampionStats', () => {
    it('returns empty array for empty input', () => {
        const result = _curateChampionStats([])
        expect(result).toEqual([])
    })

    it('passes through a single instance per family unchanged', () => {
        const stat = makeRawStatEntry({
            familyId: 'fam-1',
            familyName: 'ModelA',
            metrics: [makeRawMetric({ metricName: 'Solvability', value: 0.8 })],
        })

        const result = _curateChampionStats([stat])

        expect(result).toHaveLength(1)
        expect(result[0]).toBe(stat)
    })

    it('selects the instance with highest Top-10 across same family', () => {
        const instanceA = makeRawStatEntry({
            familyId: 'fam-shared',
            familyName: 'SharedFamily',
            instanceSlug: 'model-v1',
            metrics: [
                makeRawMetric({ metricName: 'Top-10', value: 0.5 }),
                makeRawMetric({ metricName: 'Solvability', value: 0.9 }),
            ],
        })
        const instanceB = makeRawStatEntry({
            familyId: 'fam-shared',
            familyName: 'SharedFamily',
            instanceSlug: 'model-v2',
            metrics: [
                makeRawMetric({ metricName: 'Top-10', value: 0.8 }),
                makeRawMetric({ metricName: 'Solvability', value: 0.7 }),
            ],
        })

        const result = _curateChampionStats([instanceA, instanceB])

        expect(result).toHaveLength(1)
        // Should pick instanceB (Top-10 = 0.8 > 0.5)
        expect(result[0].predictionRun.modelInstance.slug).toBe('model-v2')
    })

    it('falls back to Solvability when no instance has Top-10', () => {
        const instanceA = makeRawStatEntry({
            familyId: 'fam-solv',
            familyName: 'SolvFamily',
            instanceSlug: 'solv-v1',
            metrics: [makeRawMetric({ metricName: 'Solvability', value: 0.6 })],
        })
        const instanceB = makeRawStatEntry({
            familyId: 'fam-solv',
            familyName: 'SolvFamily',
            instanceSlug: 'solv-v2',
            metrics: [makeRawMetric({ metricName: 'Solvability', value: 0.9 })],
        })

        const result = _curateChampionStats([instanceA, instanceB])

        expect(result).toHaveLength(1)
        expect(result[0].predictionRun.modelInstance.slug).toBe('solv-v2')
    })

    it('prefers Top-10 over Solvability even if Solvability is higher', () => {
        // Instance A: no Top-10, high Solvability
        const instanceA = makeRawStatEntry({
            familyId: 'fam-mix',
            familyName: 'MixFamily',
            instanceSlug: 'mix-v1',
            metrics: [makeRawMetric({ metricName: 'Solvability', value: 0.99 })],
        })
        // Instance B: has Top-10 (even low), lower Solvability
        const instanceB = makeRawStatEntry({
            familyId: 'fam-mix',
            familyName: 'MixFamily',
            instanceSlug: 'mix-v2',
            metrics: [
                makeRawMetric({ metricName: 'Top-10', value: 0.1 }),
                makeRawMetric({ metricName: 'Solvability', value: 0.5 }),
            ],
        })

        const result = _curateChampionStats([instanceA, instanceB])

        expect(result).toHaveLength(1)
        // instanceB wins because it has Top-10
        expect(result[0].predictionRun.modelInstance.slug).toBe('mix-v2')
    })

    it('first-seen wins on equal Top-10 values (tie-breaking)', () => {
        const instanceA = makeRawStatEntry({
            familyId: 'fam-tie',
            familyName: 'TieFamily',
            instanceSlug: 'tie-v1',
            metrics: [makeRawMetric({ metricName: 'Top-10', value: 0.7 })],
        })
        const instanceB = makeRawStatEntry({
            familyId: 'fam-tie',
            familyName: 'TieFamily',
            instanceSlug: 'tie-v2',
            metrics: [makeRawMetric({ metricName: 'Top-10', value: 0.7 })],
        })

        const result = _curateChampionStats([instanceA, instanceB])

        expect(result).toHaveLength(1)
        // `best` wins on tie (reduce keeps accumulator when `currentTop10 > bestTop10` is false)
        expect(result[0].predictionRun.modelInstance.slug).toBe('tie-v1')
    })

    it('handles multiple families independently', () => {
        const familyA_v1 = makeRawStatEntry({
            familyId: 'fam-A',
            familyName: 'FamilyA',
            instanceSlug: 'a-v1',
            metrics: [makeRawMetric({ metricName: 'Solvability', value: 0.5 })],
        })
        const familyA_v2 = makeRawStatEntry({
            familyId: 'fam-A',
            familyName: 'FamilyA',
            instanceSlug: 'a-v2',
            metrics: [makeRawMetric({ metricName: 'Solvability', value: 0.8 })],
        })
        const familyB_v1 = makeRawStatEntry({
            familyId: 'fam-B',
            familyName: 'FamilyB',
            instanceSlug: 'b-v1',
            metrics: [makeRawMetric({ metricName: 'Solvability', value: 0.9 })],
        })

        const result = _curateChampionStats([familyA_v1, familyA_v2, familyB_v1])

        expect(result).toHaveLength(2)
        const slugs = result.map((r) => r.predictionRun.modelInstance.slug).sort()
        expect(slugs).toEqual(['a-v2', 'b-v1'])
    })

    it('handles family where all metrics are missing', () => {
        const instanceA = makeRawStatEntry({
            familyId: 'fam-empty',
            familyName: 'EmptyFamily',
            instanceSlug: 'empty-v1',
            metrics: [], // No metrics at all
        })
        const instanceB = makeRawStatEntry({
            familyId: 'fam-empty',
            familyName: 'EmptyFamily',
            instanceSlug: 'empty-v2',
            metrics: [],
        })

        const result = _curateChampionStats([instanceA, instanceB])

        // Should still return one champion (first-seen since both have -1)
        expect(result).toHaveLength(1)
        expect(result[0].predictionRun.modelInstance.slug).toBe('empty-v1')
    })

    it('ignores stratified (non-overall) Top-10 metrics for champion selection', () => {
        // Instance A has a high stratified Top-10 (groupKey !== null) but no overall Top-10
        const instanceA = makeRawStatEntry({
            familyId: 'fam-strat',
            familyName: 'StratFamily',
            instanceSlug: 'strat-v1',
            metrics: [
                makeRawMetric({ metricName: 'Top-10', groupKey: 3, value: 0.99 }),
                makeRawMetric({ metricName: 'Solvability', value: 0.4 }),
            ],
        })
        // Instance B has a modest overall Top-10
        const instanceB = makeRawStatEntry({
            familyId: 'fam-strat',
            familyName: 'StratFamily',
            instanceSlug: 'strat-v2',
            metrics: [
                makeRawMetric({ metricName: 'Top-10', value: 0.3 }),
                makeRawMetric({ metricName: 'Solvability', value: 0.5 }),
            ],
        })

        const result = _curateChampionStats([instanceA, instanceB])

        expect(result).toHaveLength(1)
        // instanceB wins because it has an overall Top-10
        expect(result[0].predictionRun.modelInstance.slug).toBe('strat-v2')
    })
})

// ============================================================================
// _transformStatsToLeaderboardDTOs
// ============================================================================

describe('_transformStatsToLeaderboardDTOs', () => {
    it('returns empty collections for empty input', () => {
        const result = _transformStatsToLeaderboardDTOs([], false, [])

        expect(result.leaderboardEntries).toEqual([])
        expect(result.stratifiedMetricsByStock.size).toBe(0)
        expect(result.stocks).toEqual([])
    })

    it('builds a leaderboard entry with solvability metric', () => {
        const stat = makeRawStatEntry({
            familyName: 'TestModel',
            algorithmName: 'TestAlgo',
            algorithmSlug: 'test-algo',
            stockName: 'TestStock',
            metrics: [makeRawMetric({ metricName: 'Solvability', value: 0.82 })],
        })

        const result = _transformStatsToLeaderboardDTOs([stat], false, [])

        expect(result.leaderboardEntries).toHaveLength(1)
        const entry = result.leaderboardEntries[0]
        expect(entry.modelFamilyName).toBe('TestModel')
        expect(entry.algorithmName).toBe('TestAlgo')
        expect(entry.algorithmSlug).toBe('test-algo')
        expect(entry.stockName).toBe('TestStock')
        expect(entry.metrics.solvability.value).toBe(0.82)
        expect(entry.metrics.topKAccuracy).toBeUndefined()
    })

    it('includes topKAccuracy when hasAcceptableRoutes is true', () => {
        const stat = makeRawStatEntry({
            hasAcceptableRoutes: true,
            metrics: [
                makeRawMetric({ metricName: 'Solvability', value: 0.8 }),
                makeRawMetric({ metricName: 'Top-1', value: 0.3 }),
                makeRawMetric({ metricName: 'Top-10', value: 0.6 }),
            ],
        })

        const result = _transformStatsToLeaderboardDTOs([stat], true, ['Top-1', 'Top-10'])

        const entry = result.leaderboardEntries[0]
        expect(entry.metrics.topKAccuracy).toBeDefined()
        expect(entry.metrics.topKAccuracy!['Top-1'].value).toBe(0.3)
        expect(entry.metrics.topKAccuracy!['Top-10'].value).toBe(0.6)
    })

    it('excludes topKAccuracy when hasAcceptableRoutes is false', () => {
        const stat = makeRawStatEntry({
            hasAcceptableRoutes: false,
            metrics: [
                makeRawMetric({ metricName: 'Solvability', value: 0.8 }),
                makeRawMetric({ metricName: 'Top-1', value: 0.3 }),
            ],
        })

        const result = _transformStatsToLeaderboardDTOs([stat], false, ['Top-1'])

        const entry = result.leaderboardEntries[0]
        expect(entry.metrics.topKAccuracy).toBeUndefined()
    })

    it('returns zero-valued fallback metric when solvability is missing from raw data', () => {
        const stat = makeRawStatEntry({
            metrics: [], // No metrics at all
        })

        const result = _transformStatsToLeaderboardDTOs([stat], false, [])

        // Leaderboard entry is still created with fallback
        expect(result.leaderboardEntries).toHaveLength(1)
        const entry = result.leaderboardEntries[0]
        expect(entry.metrics.solvability.value).toBe(0)
        expect(entry.metrics.solvability.nSamples).toBe(0)
        expect(entry.metrics.solvability.reliability.code).toBe('LOW_N')
        expect(entry.metrics.solvability.reliability.message).toBe('No data')
    })

    it('builds stratified metrics with overall and byGroup', () => {
        const stat = makeRawStatEntry({
            stockId: 'stock-42',
            familyName: 'StratModel',
            metrics: [
                makeRawMetric({ metricName: 'Solvability', groupKey: null, value: 0.8 }),
                makeRawMetric({ metricName: 'Solvability', groupKey: 2, value: 0.9 }),
                makeRawMetric({ metricName: 'Solvability', groupKey: 3, value: 0.7 }),
            ],
        })

        const result = _transformStatsToLeaderboardDTOs([stat], false, [])

        expect(result.stratifiedMetricsByStock.has('stock-42')).toBe(true)
        const modelMap = result.stratifiedMetricsByStock.get('stock-42')!
        expect(modelMap.has('StratModel')).toBe(true)

        const stratified = modelMap.get('StratModel')!
        expect(stratified.solvability.overall.value).toBe(0.8)
        expect(stratified.solvability.byGroup[2].value).toBe(0.9)
        expect(stratified.solvability.byGroup[3].value).toBe(0.7)
    })

    it('skips stratified entry when stat has no solvability metric', () => {
        const stat = makeRawStatEntry({
            stockId: 'stock-nosol',
            familyName: 'NoSolvModel',
            metrics: [makeRawMetric({ metricName: 'Top-1', value: 0.5 })],
        })

        const result = _transformStatsToLeaderboardDTOs([stat], true, ['Top-1'])

        // Leaderboard entry is still created (with zero-valued solvability fallback)
        expect(result.leaderboardEntries).toHaveLength(1)

        // But stratified metrics are skipped (buildStratifiedMetric('Solvability') returns null -> continue)
        const modelMap = result.stratifiedMetricsByStock.get('stock-nosol')
        expect(modelMap === undefined || modelMap.size === 0).toBe(true)
    })

    it('includes stratified topK when hasAcceptableRoutes is true', () => {
        const stat = makeRawStatEntry({
            stockId: 'stock-topk',
            familyName: 'TopKModel',
            hasAcceptableRoutes: true,
            metrics: [
                makeRawMetric({ metricName: 'Solvability', value: 0.8 }),
                makeRawMetric({ metricName: 'Top-1', groupKey: null, value: 0.3 }),
                makeRawMetric({ metricName: 'Top-1', groupKey: 2, value: 0.4 }),
                makeRawMetric({ metricName: 'Top-10', groupKey: null, value: 0.6 }),
            ],
        })

        const result = _transformStatsToLeaderboardDTOs([stat], true, ['Top-1', 'Top-10'])

        const modelData = result.stratifiedMetricsByStock.get('stock-topk')!.get('TopKModel')!
        expect(modelData.topKAccuracy).toBeDefined()
        expect(modelData.topKAccuracy!['Top-1'].overall.value).toBe(0.3)
        expect(modelData.topKAccuracy!['Top-1'].byGroup[2].value).toBe(0.4)
        expect(modelData.topKAccuracy!['Top-10'].overall.value).toBe(0.6)
    })

    it('deduplicates stocks', () => {
        const stat1 = makeRawStatEntry({
            stockId: 'shared-stock',
            stockName: 'SharedStock',
            familyId: 'fam-1',
            familyName: 'Model1',
            metrics: [makeRawMetric({ metricName: 'Solvability', value: 0.8 })],
        })
        const stat2 = makeRawStatEntry({
            stockId: 'shared-stock',
            stockName: 'SharedStock',
            familyId: 'fam-2',
            familyName: 'Model2',
            metrics: [makeRawMetric({ metricName: 'Solvability', value: 0.7 })],
        })

        const result = _transformStatsToLeaderboardDTOs([stat1, stat2], false, [])

        // Two leaderboard entries but only 1 unique stock
        expect(result.leaderboardEntries).toHaveLength(2)
        expect(result.stocks).toHaveLength(1)
        expect(result.stocks[0].id).toBe('shared-stock')
        expect(result.stocks[0].name).toBe('SharedStock')
    })

    it('formats version string correctly in leaderboard entry', () => {
        const stat = makeRawStatEntry({
            versionMajor: 2,
            versionMinor: 3,
            versionPatch: 1,
            versionPrerelease: 'beta',
            metrics: [makeRawMetric({ metricName: 'Solvability', value: 0.5 })],
        })

        const result = _transformStatsToLeaderboardDTOs([stat], false, [])

        expect(result.leaderboardEntries[0].version).toBe('v2.3.1-beta')
    })

    it('formats version without prerelease correctly', () => {
        const stat = makeRawStatEntry({
            versionMajor: 1,
            versionMinor: 0,
            versionPatch: 0,
            versionPrerelease: null,
            metrics: [makeRawMetric({ metricName: 'Solvability', value: 0.5 })],
        })

        const result = _transformStatsToLeaderboardDTOs([stat], false, [])

        expect(result.leaderboardEntries[0].version).toBe('v1.0.0')
    })

    it('includes totalWallTime and totalCost in leaderboard entry', () => {
        const stat = makeRawStatEntry({
            totalWallTime: 3600.5,
            totalCost: 12.5,
            metrics: [makeRawMetric({ metricName: 'Solvability', value: 0.8 })],
        })

        const result = _transformStatsToLeaderboardDTOs([stat], false, [])

        const entry = result.leaderboardEntries[0]
        expect(entry.totalWallTime).toBe(3600.5)
        expect(entry.totalCost).toBe(12.5)
    })

    it('sets stock itemCount to -1 (placeholder)', () => {
        const stat = makeRawStatEntry({
            metrics: [makeRawMetric({ metricName: 'Solvability', value: 0.8 })],
        })

        const result = _transformStatsToLeaderboardDTOs([stat], false, [])

        expect(result.stocks[0].itemCount).toBe(-1)
    })

    it('maps reliabilityCode correctly in metric results', () => {
        const stat = makeRawStatEntry({
            metrics: [
                makeRawMetric({
                    metricName: 'Solvability',
                    value: 0.5,
                    reliabilityCode: 'LOW_N',
                    reliabilityMessage: 'Small sample',
                }),
            ],
        })

        const result = _transformStatsToLeaderboardDTOs([stat], false, [])

        const entry = result.leaderboardEntries[0]
        expect(entry.metrics.solvability.reliability.code).toBe('LOW_N')
        expect(entry.metrics.solvability.reliability.message).toBe('Small sample')
    })

    it('handles multiple stats for same stock building up the model map', () => {
        const stat1 = makeRawStatEntry({
            stockId: 'multi-stock',
            stockName: 'MultiStock',
            familyId: 'fam-X',
            familyName: 'ModelX',
            metrics: [makeRawMetric({ metricName: 'Solvability', value: 0.8 })],
        })
        const stat2 = makeRawStatEntry({
            stockId: 'multi-stock',
            stockName: 'MultiStock',
            familyId: 'fam-Y',
            familyName: 'ModelY',
            metrics: [makeRawMetric({ metricName: 'Solvability', value: 0.6 })],
        })

        const result = _transformStatsToLeaderboardDTOs([stat1, stat2], false, [])

        const modelMap = result.stratifiedMetricsByStock.get('multi-stock')!
        expect(modelMap.size).toBe(2)
        expect(modelMap.has('ModelX')).toBe(true)
        expect(modelMap.has('ModelY')).toBe(true)
        expect(modelMap.get('ModelX')!.solvability.overall.value).toBe(0.8)
        expect(modelMap.get('ModelY')!.solvability.overall.value).toBe(0.6)
    })
})
