/**
 * Unit tests for pure functions in prediction-loader.service.ts
 *
 * Tests transformPythonStatistics (snake_case -> camelCase conversion),
 * computeRouteLength, and isRouteConvergent using carbon chain factories.
 */

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import type { PythonModelStatistics, PythonMolecule } from '@/lib/services/loaders/prediction-loader.service'
import {
    computeRouteLength,
    isRouteConvergent,
    transformPythonStatistics,
} from '@/lib/services/loaders/prediction-loader.service'

import {
    makeBinaryTreePythonRoute,
    makeConvergentPythonRoute,
    makeLeafMolecule,
    makeLinearPythonRoute,
    syntheticInchiKey,
} from '../../../helpers/factories'

// ============================================================================
// computeRouteLength
// ============================================================================

describe('computeRouteLength', () => {
    it('returns 0 for a leaf molecule', () => {
        const leaf = makeLeafMolecule('C')
        expect(computeRouteLength(leaf)).toBe(0)
    })

    it.each([1, 2, 3, 4, 5, 6])('returns %d for a linear route of depth %d', (depth) => {
        const route = makeLinearPythonRoute(depth)
        expect(computeRouteLength(route.target)).toBe(depth)
    })

    it('returns correct depth for convergent routes', () => {
        const route = makeConvergentPythonRoute(3)
        expect(computeRouteLength(route.target)).toBe(3)
    })

    it('returns correct depth for binary tree routes', () => {
        const route = makeBinaryTreePythonRoute(3)
        expect(computeRouteLength(route.target)).toBe(3)
    })

    it('(property) linear route length always equals the factory depth parameter', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 10 }), (depth) => {
                const route = makeLinearPythonRoute(depth)
                return computeRouteLength(route.target) === depth
            })
        )
    })

    it('(property) convergent route length always equals the factory depth parameter', () => {
        fc.assert(
            fc.property(fc.integer({ min: 2, max: 8 }), (depth) => {
                const route = makeConvergentPythonRoute(depth)
                return computeRouteLength(route.target) === depth
            })
        )
    })

    it('(property) binary tree route length always equals the factory depth parameter', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 6 }), (depth) => {
                const route = makeBinaryTreePythonRoute(depth)
                return computeRouteLength(route.target) === depth
            })
        )
    })
})

// ============================================================================
// isRouteConvergent
// ============================================================================

describe('isRouteConvergent', () => {
    it('returns false for a leaf molecule', () => {
        const leaf = makeLeafMolecule('C')
        expect(isRouteConvergent(leaf)).toBe(false)
    })

    it('returns false for linear routes (single reactant at each step)', () => {
        const route = makeLinearPythonRoute(3)
        expect(isRouteConvergent(route.target)).toBe(false)
    })

    it('returns true for convergent routes (multiple reactants)', () => {
        const route = makeConvergentPythonRoute(2)
        expect(isRouteConvergent(route.target)).toBe(true)
    })

    it('returns true for binary tree routes', () => {
        const route = makeBinaryTreePythonRoute(1)
        expect(isRouteConvergent(route.target)).toBe(true)
    })

    it('(property) linear routes are never convergent', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 10 }), (depth) => {
                const route = makeLinearPythonRoute(depth)
                return isRouteConvergent(route.target) === false
            })
        )
    })

    it('(property) convergent routes are always convergent', () => {
        fc.assert(
            fc.property(fc.integer({ min: 2, max: 8 }), (depth) => {
                const route = makeConvergentPythonRoute(depth)
                return isRouteConvergent(route.target) === true
            })
        )
    })

    it('(property) binary tree routes are always convergent', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 6 }), (depth) => {
                const route = makeBinaryTreePythonRoute(depth)
                return isRouteConvergent(route.target) === true
            })
        )
    })

    it('detects convergence deep in a tree', () => {
        // Linear chain at top, but convergent reaction at the bottom
        const leaf1 = makeLeafMolecule('C')
        const leaf2 = makeLeafMolecule('O')
        const convergentStep: PythonMolecule = {
            smiles: 'CO',
            inchikey: syntheticInchiKey('CO'),
            synthesis_step: { reactants: [leaf1, leaf2] },
        }
        const linearAbove: PythonMolecule = {
            smiles: 'CCO',
            inchikey: syntheticInchiKey('CCO'),
            synthesis_step: { reactants: [convergentStep] },
        }

        expect(isRouteConvergent(linearAbove)).toBe(true)
    })
})

// ============================================================================
// transformPythonStatistics
// ============================================================================

describe('transformPythonStatistics', () => {
    const minimalPythonStats: PythonModelStatistics = {
        solvability: {
            metric_name: 'solvability',
            overall: {
                value: 0.75,
                ci_lower: 0.7,
                ci_upper: 0.8,
                n_samples: 100,
                reliability: { code: 'OK', message: 'Sufficient samples' },
            },
        },
    }

    it('transforms snake_case to camelCase for solvability', () => {
        const result = transformPythonStatistics(minimalPythonStats)

        expect(result.solvability.metricName).toBe('solvability')
        expect(result.solvability.overall.value).toBe(0.75)
        expect(result.solvability.overall.ciLower).toBe(0.7)
        expect(result.solvability.overall.ciUpper).toBe(0.8)
        expect(result.solvability.overall.nSamples).toBe(100)
        expect(result.solvability.overall.reliability.code).toBe('OK')
        expect(result.solvability.overall.reliability.message).toBe('Sufficient samples')
    })

    it('preserves all numeric values exactly', () => {
        const result = transformPythonStatistics(minimalPythonStats)

        expect(result.solvability.overall.value).toStrictEqual(0.75)
        expect(result.solvability.overall.ciLower).toStrictEqual(0.7)
        expect(result.solvability.overall.ciUpper).toStrictEqual(0.8)
        expect(result.solvability.overall.nSamples).toStrictEqual(100)
    })

    it('transforms top_k_accuracy when present', () => {
        const statsWithTopK: PythonModelStatistics = {
            ...minimalPythonStats,
            top_k_accuracy: {
                '1': {
                    metric_name: 'Top-1',
                    overall: {
                        value: 0.3,
                        ci_lower: 0.25,
                        ci_upper: 0.35,
                        n_samples: 100,
                        reliability: { code: 'OK', message: 'OK' },
                    },
                    by_group: {
                        '3': {
                            value: 0.5,
                            ci_lower: 0.4,
                            ci_upper: 0.6,
                            n_samples: 50,
                            reliability: { code: 'OK', message: 'OK' },
                        },
                    },
                },
            },
        }

        const result = transformPythonStatistics(statsWithTopK)

        expect(result.topKAccuracy).toBeDefined()
        expect(result.topKAccuracy!['1'].metricName).toBe('Top-1')
        expect(result.topKAccuracy!['1'].overall.value).toBe(0.3)

        // Stratified by group
        expect(result.topKAccuracy!['1'].byGroup[3]).toBeDefined()
        expect(result.topKAccuracy!['1'].byGroup[3].value).toBe(0.5)
    })

    it('handles missing optional fields gracefully', () => {
        const result = transformPythonStatistics(minimalPythonStats)

        expect(result.topKAccuracy).toBeUndefined()
        expect(result.rankDistribution).toBeUndefined()
        expect(result.expectedRank).toBeUndefined()
        expect(result.totalWallTime).toBeUndefined()
        expect(result.totalCpuTime).toBeUndefined()
        expect(result.meanWallTime).toBeUndefined()
        expect(result.meanCpuTime).toBeUndefined()
    })

    it('transforms rank_distribution when present', () => {
        const statsWithRank: PythonModelStatistics = {
            ...minimalPythonStats,
            rank_distribution: [
                { rank: 1, probability: 0.6 },
                { rank: 2, probability: 0.3 },
                { rank: 3, probability: 0.1 },
            ],
            expected_rank: 1.5,
        }

        const result = transformPythonStatistics(statsWithRank)

        expect(result.rankDistribution).toHaveLength(3)
        expect(result.rankDistribution![0]).toEqual({ rank: 1, probability: 0.6 })
        expect(result.expectedRank).toBe(1.5)
    })

    it('transforms runtime metrics when present', () => {
        const statsWithRuntime: PythonModelStatistics = {
            ...minimalPythonStats,
            total_wall_time: 3600.5,
            total_cpu_time: 7200.0,
            mean_wall_time: 12.5,
            mean_cpu_time: 25.0,
        }

        const result = transformPythonStatistics(statsWithRuntime)

        expect(result.totalWallTime).toBe(3600.5)
        expect(result.totalCpuTime).toBe(7200.0)
        expect(result.meanWallTime).toBe(12.5)
        expect(result.meanCpuTime).toBe(25.0)
    })

    it('treats null runtime metrics as absent', () => {
        const statsWithNulls: PythonModelStatistics = {
            ...minimalPythonStats,
            total_wall_time: null,
            total_cpu_time: null,
            mean_wall_time: null,
            mean_cpu_time: null,
        }

        const result = transformPythonStatistics(statsWithNulls)

        expect(result.totalWallTime).toBeUndefined()
        expect(result.totalCpuTime).toBeUndefined()
        expect(result.meanWallTime).toBeUndefined()
        expect(result.meanCpuTime).toBeUndefined()
    })

    it('(property) all solvability values are preserved through transformation', () => {
        fc.assert(
            fc.property(
                fc.double({ min: 0, max: 1, noNaN: true }),
                fc.double({ min: 0, max: 1, noNaN: true }),
                fc.double({ min: 0, max: 1, noNaN: true }),
                fc.integer({ min: 1, max: 10000 }),
                (value, ciLower, ciUpper, nSamples) => {
                    const stats: PythonModelStatistics = {
                        solvability: {
                            metric_name: 'solvability',
                            overall: {
                                value,
                                ci_lower: ciLower,
                                ci_upper: ciUpper,
                                n_samples: nSamples,
                                reliability: { code: 'OK', message: 'OK' },
                            },
                        },
                    }

                    const result = transformPythonStatistics(stats)

                    return (
                        result.solvability.overall.value === value &&
                        result.solvability.overall.ciLower === ciLower &&
                        result.solvability.overall.ciUpper === ciUpper &&
                        result.solvability.overall.nSamples === nSamples
                    )
                }
            )
        )
    })

    it('(property) byGroup keys are parsed as integers', () => {
        fc.assert(
            fc.property(fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 1, maxLength: 5 }), (groupKeys) => {
                const uniqueKeys = [...new Set(groupKeys)]
                const byGroup: Record<string, PythonModelStatistics['solvability']['overall']> = {}
                for (const key of uniqueKeys) {
                    byGroup[String(key)] = {
                        value: 0.5,
                        ci_lower: 0.4,
                        ci_upper: 0.6,
                        n_samples: 50,
                        reliability: { code: 'OK', message: 'OK' },
                    }
                }

                const stats: PythonModelStatistics = {
                    solvability: {
                        metric_name: 'solvability',
                        overall: {
                            value: 0.75,
                            ci_lower: 0.7,
                            ci_upper: 0.8,
                            n_samples: 100,
                            reliability: { code: 'OK', message: 'OK' },
                        },
                        by_group: byGroup,
                    },
                }

                const result = transformPythonStatistics(stats)

                // All group keys should be numeric
                for (const key of Object.keys(result.solvability.byGroup)) {
                    if (isNaN(Number(key))) return false
                }
                return Object.keys(result.solvability.byGroup).length === uniqueKeys.length
            })
        )
    })
})
