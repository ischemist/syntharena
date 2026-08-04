import fc from 'fast-check'
import { ReliabilityCode } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import type { PythonMolecule } from '@/lib/services/loaders/prediction-loader.service'
import {
    computeRouteLength,
    isRouteConvergent,
    transformRetrocastAnalysis,
} from '@/lib/services/loaders/prediction-loader.service'

import {
    makeBinaryTreePythonRoute,
    makeConvergentPythonRoute,
    makeLeafMolecule,
    makeLinearPythonRoute,
    syntheticInchiKey,
} from '../../../helpers/factories'

describe('planner route topology helpers', () => {
    it('computes leaf, linear, convergent, and binary route depths', () => {
        expect(computeRouteLength(makeLeafMolecule())).toBe(0)
        expect(computeRouteLength(makeLinearPythonRoute(4).target)).toBe(4)
        expect(computeRouteLength(makeConvergentPythonRoute(3).target)).toBe(3)
        expect(computeRouteLength(makeBinaryTreePythonRoute(3).target)).toBe(3)
    })

    it('supports schema-v2 product_of trees', () => {
        const route: PythonMolecule = {
            smiles: 'CC',
            inchikey: syntheticInchiKey('CC'),
            product_of: { reactants: [makeLeafMolecule('C')] },
        }
        expect(computeRouteLength(route)).toBe(1)
        expect(isRouteConvergent(route)).toBe(false)
    })

    it('distinguishes bimolecular leaf reactions from convergent synthesis', () => {
        const bimolecular: PythonMolecule = {
            smiles: 'CO',
            inchikey: syntheticInchiKey('CO'),
            product_of: { reactants: [makeLeafMolecule('C'), makeLeafMolecule('O')] },
        }
        expect(isRouteConvergent(bimolecular)).toBe(false)
        expect(isRouteConvergent(makeConvergentPythonRoute(2).target)).toBe(true)
        expect(isRouteConvergent(makeBinaryTreePythonRoute(2).target)).toBe(true)
    })

    it('detects convergence below a linear root', () => {
        const convergent = makeConvergentPythonRoute(2).target
        const root: PythonMolecule = {
            smiles: 'CCCCC',
            inchikey: syntheticInchiKey('linear-above-convergence'),
            product_of: { reactants: [convergent] },
        }
        expect(isRouteConvergent(root)).toBe(true)
    })

    it('preserves depth and convergence invariants over generated trees', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 8 }), (depth) => {
                const linear = makeLinearPythonRoute(depth).target
                return computeRouteLength(linear) === depth && !isRouteConvergent(linear)
            })
        )
        fc.assert(
            fc.property(fc.integer({ min: 2, max: 6 }), (depth) => {
                const binary = makeBinaryTreePythonRoute(depth).target
                return computeRouteLength(binary) === depth && isRouteConvergent(binary)
            })
        )
    })
})

describe('RetroCast analysis projection', () => {
    it('preserves canonical keys, exact strata, uncertainty, and reliability', () => {
        const result = transformRetrocastAnalysis({
            schema_version: '2',
            bootstrap_resamples: 1000,
            metrics: {
                tier_0_validity_rate: {
                    value: 0.8,
                    count: 100,
                    ci_low: 0.7,
                    ci_high: 0.9,
                    reliability: { code: 'OK', message: 'Reliable.' },
                },
                'solv_0[buyables-stock]_rate': {
                    value: 0.6,
                    count: 100,
                    ci_low: null,
                    ci_high: null,
                    reliability: null,
                },
            },
            by_stratum: {
                top_10_route_length_5: {
                    'solv_0[buyables-stock]_rate': {
                        value: 0.7,
                        count: 20,
                        ci_low: 0.5,
                        ci_high: 0.8,
                        reliability: { code: 'LOW_N', message: 'Small group.' },
                    },
                },
            },
            runtime: {
                timed_target_count: 0,
                total_wall_time: null,
                total_cpu_time: null,
                mean_wall_time: null,
                mean_cpu_time: null,
            },
        })

        expect(result).toContainEqual({
            metricKey: 'tier_0_validity_rate',
            stratum: '',
            value: 0.8,
            ciLower: 0.7,
            ciUpper: 0.9,
            nSamples: 100,
            reliabilityCode: ReliabilityCode.OK,
            reliabilityMessage: 'Reliable.',
        })
        expect(result).toContainEqual(
            expect.objectContaining({
                metricKey: 'solv_0[buyables-stock]_rate',
                stratum: 'top_10_route_length_5',
                reliabilityCode: ReliabilityCode.LOW_N,
            })
        )
    })

    it('rejects unsupported schemas and unknown reliability codes', () => {
        expect(() =>
            transformRetrocastAnalysis({ schema_version: '1', metrics: {}, by_stratum: {}, runtime: {} } as never)
        ).toThrow('Unsupported analysis schema')
        expect(() =>
            transformRetrocastAnalysis({
                schema_version: '2',
                metrics: {
                    tier_0_validity_rate: {
                        value: 1,
                        count: 1,
                        reliability: { code: 'NEW_CODE', message: 'new' },
                    },
                },
                by_stratum: {},
                runtime: {},
            } as never)
        ).toThrow('Unknown RetroCast reliability code')
    })
})
