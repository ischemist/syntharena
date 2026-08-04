import { describe, expect, it } from 'vitest'

import { transformRetrocastAnalysis, validateEvaluationBundle } from '@/lib/services/loaders/prediction-loader.service'

import { makeEvaluationBundle } from '../../../helpers/evaluation-bundle'

describe('Solv-N artifact contract', () => {
    it('preserves every canonical metric key, exact stratum, and nullable uncertainty', () => {
        const bundle = makeEvaluationBundle()
        const metrics = transformRetrocastAnalysis(bundle.analysis)

        expect(metrics.map((metric) => `${metric.stratum}:${metric.metricKey}`)).toEqual([
            ':tier_0_validity_rate',
            ':solv_0[test-stock]_rate',
            ':solv_0[test-stock]_mrr',
            ':acceptable_reconstruction_top_10[test-stock]',
            'depth 2:tier_0_validity_rate',
            'depth 2:solv_0[test-stock]_rate',
        ])
        expect(metrics[0]).toMatchObject({
            ciLower: null,
            ciUpper: null,
            reliabilityCode: null,
            reliabilityMessage: null,
        })
    })

    it('recomputes target-level Tier-0 and Solv-0 independently', () => {
        expect(() => validateEvaluationBundle(makeEvaluationBundle())).not.toThrow()
        expect(() => validateEvaluationBundle(makeEvaluationBundle({ solv0Rate: 1 }))).toThrow(
            'solv_0[test-stock]_rate disagrees'
        )
    })

    it('requires explicit Tier-0 evidence but not unevaluated higher tiers', () => {
        const bundle = makeEvaluationBundle()
        bundle.evaluation.targets['target-a'].candidates[0].validity.tiers = {}
        expect(() => validateEvaluationBundle(bundle)).toThrow('missing Tier-0 status')
    })

    it('rejects headline denominators that are not target denominators', () => {
        const bundle = makeEvaluationBundle()
        bundle.analysis.metrics.tier_0_validity_rate.count = 1
        expect(() => validateEvaluationBundle(bundle)).toThrow('denominator')
    })
})
