/**
 * Unit tests for pure functions in prediction-loader.service.ts
 *
 * Tests computeRouteLength, isRouteConvergent, and RetroCast analysis transforms.
 */

import fc from 'fast-check'
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

// ============================================================================
// computeRouteLength
// ============================================================================

describe('computeRouteLength', () => {
    it('returns 0 for a leaf molecule', () => {
        const leaf = makeLeafMolecule('C')
        expect(computeRouteLength(leaf)).toBe(0)
    })

    it('supports RetroCast v0.7 product_of route trees', () => {
        const leaf = {
            smiles: 'C',
            inchikey: syntheticInchiKey('C'),
            annotations: {},
        }
        const route: PythonMolecule = {
            smiles: 'CC',
            inchikey: syntheticInchiKey('CC'),
            product_of: { reactants: [leaf] },
            annotations: {},
        }

        expect(computeRouteLength(route)).toBe(1)
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

    it('returns false for a depth-1 binary tree (root merges two leaves — bimolecular, not convergent)', () => {
        // At depth 1, makeBinaryTreePythonRoute produces: CC <- (C + C)
        // Both reactants are leaf molecules (no synthesis steps). This is a bimolecular
        // reaction with two buyable starting materials, NOT a convergent synthesis.
        const route = makeBinaryTreePythonRoute(1)
        expect(isRouteConvergent(route.target)).toBe(false)
    })

    it('returns true for binary tree routes at depth >= 2 (non-leaf sub-trees merge)', () => {
        // At depth 2: CCCC <- (CC <- (C+C)) + (CC <- (C+C))
        // The two children of the root ARE themselves synthesised (have synthesis steps).
        const route = makeBinaryTreePythonRoute(2)
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

    it('(property) binary tree routes at depth >= 2 are always convergent', () => {
        // Depth 1 produces a bimolecular leaf reaction (not convergent by our definition).
        // At depth >= 2 the immediate children of the root are themselves synthesised,
        // so the root has 2+ non-leaf reactants => convergent.
        fc.assert(
            fc.property(fc.integer({ min: 2, max: 6 }), (depth) => {
                const route = makeBinaryTreePythonRoute(depth)
                return isRouteConvergent(route.target) === true
            })
        )
    })

    it('returns false for a two-leaf bimolecular reaction (A + B -> C, both buyable)', () => {
        // C + O -> CO: both reactants are leaves (buyable starting materials).
        // This is a bimolecular reaction, NOT a convergent synthesis.
        const leaf1 = makeLeafMolecule('C')
        const leaf2 = makeLeafMolecule('O')
        const bimolecular: PythonMolecule = {
            smiles: 'CO',
            inchikey: syntheticInchiKey('CO'),
            product_of: { reactants: [leaf1, leaf2] },
        }
        expect(isRouteConvergent(bimolecular)).toBe(false)
    })

    it('detects convergence in RetroCast v0.7 product_of route trees', () => {
        const left: PythonMolecule = {
            smiles: 'CC',
            inchikey: syntheticInchiKey('left'),
            product_of: { reactants: [makeLeafMolecule('C')] },
        }
        const right: PythonMolecule = {
            smiles: 'CO',
            inchikey: syntheticInchiKey('right'),
            product_of: { reactants: [makeLeafMolecule('O')] },
        }
        const root: PythonMolecule = {
            smiles: 'CCO',
            inchikey: syntheticInchiKey('root'),
            product_of: { reactants: [left, right] },
        }

        expect(isRouteConvergent(root)).toBe(true)
    })

    it('detects convergence deep in a tree (two non-leaf branches merge)', () => {
        // Linear chain at top, but truly convergent reaction buried below:
        //   CCCCO
        //     |
        //   CCO  (linear: CC <- C)
        //   /  \
        //  CC   O (but O is synthesised, not buyable)
        //  |    |
        //  C    C2
        // i.e. two branches that are each synthesised merge at CCO
        const leaf_c = makeLeafMolecule('C')
        const leaf_c2 = makeLeafMolecule('CC') // different leaf

        // Branch 1: CC (synthesised from C)
        const branch1: PythonMolecule = {
            smiles: 'CC',
            inchikey: syntheticInchiKey('branch1_CC'),
            product_of: { reactants: [leaf_c] },
        }
        // Branch 2: O (synthesised from CC)
        const branch2: PythonMolecule = {
            smiles: 'O',
            inchikey: syntheticInchiKey('branch2_O'),
            product_of: { reactants: [leaf_c2] },
        }
        // Convergent node: two NON-leaf branches merge
        const convergentNode: PythonMolecule = {
            smiles: 'CCO',
            inchikey: syntheticInchiKey('CCO'),
            product_of: { reactants: [branch1, branch2] },
        }
        // Linear step above the convergent node
        const linearAbove: PythonMolecule = {
            smiles: 'CCCO',
            inchikey: syntheticInchiKey('CCCO'),
            product_of: { reactants: [convergentNode] },
        }

        expect(isRouteConvergent(linearAbove)).toBe(true)
    })
})

describe('transformRetrocastAnalysis', () => {
    it('maps v0.7 analysis metrics into solvability and top-k statistics', () => {
        const result = transformRetrocastAnalysis({
            schema_version: '2',
            metrics: {
                'solv_0[buyables-stock]_rate': {
                    value: 0.8,
                    count: 100,
                    ci_low: 0.7,
                    ci_high: 0.9,
                    reliability: { code: 'OK', message: 'Reliable.' },
                },
                'acceptable_reconstruction_top_1[buyables-stock]': {
                    value: 0.4,
                    count: 100,
                    ci_low: 0.3,
                    ci_high: 0.5,
                    reliability: { code: 'OK', message: 'Reliable.' },
                },
            },
            by_stratum: {
                'depth 2': {
                    'solv_0[buyables-stock]_rate': {
                        value: 0.9,
                        count: 40,
                        ci_low: 0.8,
                        ci_high: 1,
                        reliability: { code: 'EXTREME_P', message: 'Boundary value.' },
                    },
                    'acceptable_reconstruction_top_1[buyables-stock]': {
                        value: 0.5,
                        count: 40,
                        ci_low: 0.35,
                        ci_high: 0.65,
                        reliability: { code: 'OK', message: 'Reliable.' },
                    },
                },
            },
            runtime: {
                total_wall_time: 12,
                total_cpu_time: 10,
                mean_wall_time: 1.2,
                mean_cpu_time: 1,
            },
        })

        expect(result.solvability.overall.value).toBe(0.8)
        expect(result.solvability.byGroup[2].value).toBe(0.9)
        expect(result.topKAccuracy?.['1'].overall.value).toBe(0.4)
        expect(result.topKAccuracy?.['1'].byGroup[2].value).toBe(0.5)
        expect(result.totalWallTime).toBe(12)
        expect(result.meanCpuTime).toBe(1)
    })
})
