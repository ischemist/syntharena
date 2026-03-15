/**
 * Unit tests for src/lib/utils.ts
 *
 * Tests pure utility functions: version formatting/comparison,
 * plateau metric filtering, bibtex formatting, error formatting.
 */

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import type { MetricResult, StratifiedMetric, Versionable } from '@/types'
import {
    compareVersions,
    filterPlateauMetrics,
    filterPlateauStratifiedMetrics,
    formatBibtex,
    formatError,
    formatVersion,
} from '@/lib/utils'

// ============================================================================
// formatError
// ============================================================================

describe('formatError', () => {
    it('extracts message from Error objects', () => {
        expect(formatError(new Error('something broke'))).toBe('something broke')
    })

    it('converts strings to themselves', () => {
        expect(formatError('raw string')).toBe('raw string')
    })

    it('converts numbers to string', () => {
        expect(formatError(42)).toBe('42')
    })

    it('converts null to string', () => {
        expect(formatError(null)).toBe('null')
    })

    it('converts undefined to string', () => {
        expect(formatError(undefined)).toBe('undefined')
    })
})

// ============================================================================
// formatVersion
// ============================================================================

describe('formatVersion', () => {
    it.each([
        { input: { versionMajor: 1, versionMinor: 0, versionPatch: 0 }, expected: 'v1.0.0' },
        { input: { versionMajor: 2, versionMinor: 3, versionPatch: 4 }, expected: 'v2.3.4' },
        { input: { versionMajor: 0, versionMinor: 0, versionPatch: 1 }, expected: 'v0.0.1' },
        {
            input: { versionMajor: 1, versionMinor: 0, versionPatch: 0, versionPrerelease: 'beta' },
            expected: 'v1.0.0-beta',
        },
        {
            input: { versionMajor: 1, versionMinor: 2, versionPatch: 3, versionPrerelease: 'alpha.1' },
            expected: 'v1.2.3-alpha.1',
        },
        {
            input: { versionMajor: 1, versionMinor: 0, versionPatch: 0, versionPrerelease: null },
            expected: 'v1.0.0',
        },
        {
            input: { versionMajor: 1, versionMinor: 0, versionPatch: 0, versionPrerelease: undefined },
            expected: 'v1.0.0',
        },
    ])('formats $expected correctly', ({ input, expected }) => {
        expect(formatVersion(input)).toBe(expected)
    })

    it('(property) always starts with "v"', () => {
        fc.assert(
            fc.property(fc.nat(100), fc.nat(100), fc.nat(100), (major, minor, patch) => {
                const result = formatVersion({ versionMajor: major, versionMinor: minor, versionPatch: patch })
                return result.startsWith('v')
            })
        )
    })

    it('(property) contains exactly two dots', () => {
        fc.assert(
            fc.property(fc.nat(100), fc.nat(100), fc.nat(100), (major, minor, patch) => {
                const result = formatVersion({ versionMajor: major, versionMinor: minor, versionPatch: patch })
                const dots = result.split('.').length - 1
                return dots === 2
            })
        )
    })
})

// ============================================================================
// compareVersions
// ============================================================================

describe('compareVersions', () => {
    const v = (major: number, minor: number, patch: number, pre?: string): Versionable => ({
        versionMajor: major,
        versionMinor: minor,
        versionPatch: patch,
        versionPrerelease: pre,
    })

    it.each([
        { a: v(2, 0, 0), b: v(1, 0, 0), desc: 'major version' },
        { a: v(1, 2, 0), b: v(1, 1, 0), desc: 'minor version' },
        { a: v(1, 0, 2), b: v(1, 0, 1), desc: 'patch version' },
        { a: v(1, 0, 0), b: v(1, 0, 0, 'beta'), desc: 'stable > prerelease' },
    ])('$desc: a > b', ({ a, b }) => {
        expect(compareVersions(a, b)).toBeGreaterThan(0)
    })

    it('returns 0 for equal versions', () => {
        expect(compareVersions(v(1, 2, 3), v(1, 2, 3))).toBe(0)
    })

    it('compares prereleases lexicographically', () => {
        expect(compareVersions(v(1, 0, 0, 'beta'), v(1, 0, 0, 'alpha'))).toBeGreaterThan(0)
    })

    it('(property) reflexive: compare(a, a) === 0', () => {
        fc.assert(
            fc.property(fc.nat(50), fc.nat(50), fc.nat(50), (major, minor, patch) => {
                const a = v(major, minor, patch)
                return compareVersions(a, a) === 0
            })
        )
    })

    it('(property) antisymmetric: sign(compare(a,b)) === -sign(compare(b,a))', () => {
        fc.assert(
            fc.property(
                fc.nat(20),
                fc.nat(20),
                fc.nat(20),
                fc.nat(20),
                fc.nat(20),
                fc.nat(20),
                (aMaj, aMin, aPat, bMaj, bMin, bPat) => {
                    const a = v(aMaj, aMin, aPat)
                    const b = v(bMaj, bMin, bPat)
                    return Math.sign(compareVersions(a, b)) === -Math.sign(compareVersions(b, a))
                }
            )
        )
    })

    it('(property) sorting produces a stable ascending order', () => {
        fc.assert(
            fc.property(
                fc.array(fc.tuple(fc.nat(10), fc.nat(10), fc.nat(10)), { minLength: 2, maxLength: 20 }),
                (versions) => {
                    const versionables = versions.map(([major, minor, patch]) => v(major, minor, patch))
                    const sorted = [...versionables].sort(compareVersions)

                    // every adjacent pair should be non-decreasing
                    for (let i = 1; i < sorted.length; i++) {
                        if (compareVersions(sorted[i - 1], sorted[i]) > 0) return false
                    }
                    return true
                }
            )
        )
    })
})

// ============================================================================
// filterPlateauMetrics
// ============================================================================

function buildMetricEntry(name: string, value: number): { name: string; metric: MetricResult } {
    return {
        name,
        metric: {
            value,
            ciLower: value - 0.05,
            ciUpper: value + 0.05,
            nSamples: 100,
            reliability: { code: 'OK', message: 'OK' },
        },
    }
}

describe('filterPlateauMetrics', () => {
    it('passes through non-Top-k metrics unchanged', () => {
        const metrics = [buildMetricEntry('Solvability', 0.8)]
        const result = filterPlateauMetrics(metrics)
        expect(result).toHaveLength(1)
        expect(result[0].name).toBe('Solvability')
    })

    it('keeps all Top-k metrics when no plateau', () => {
        const metrics = [
            buildMetricEntry('Top-1', 0.3),
            buildMetricEntry('Top-5', 0.5),
            buildMetricEntry('Top-10', 0.7),
        ]
        const result = filterPlateauMetrics(metrics)
        expect(result).toHaveLength(3)
    })

    it('keeps first 2 occurrences of a plateau value', () => {
        const metrics = [
            buildMetricEntry('Top-1', 0.3),
            buildMetricEntry('Top-5', 0.6),
            buildMetricEntry('Top-10', 0.6),
            buildMetricEntry('Top-20', 0.6),
            buildMetricEntry('Top-50', 0.6),
        ]
        const result = filterPlateauMetrics(metrics)
        expect(result.map((m) => m.name)).toEqual(['Top-1', 'Top-5', 'Top-10'])
    })

    it('handles multiple plateaus independently', () => {
        const metrics = [
            buildMetricEntry('Top-1', 0.3),
            buildMetricEntry('Top-5', 0.3),
            buildMetricEntry('Top-10', 0.3),
            buildMetricEntry('Top-20', 0.6),
            buildMetricEntry('Top-50', 0.6),
            buildMetricEntry('Top-100', 0.6),
        ]
        const result = filterPlateauMetrics(metrics)
        expect(result.map((m) => m.name)).toEqual(['Top-1', 'Top-5', 'Top-20', 'Top-50'])
    })

    it('preserves non-Top-k metrics in their original position', () => {
        const metrics = [
            buildMetricEntry('Solvability', 0.8),
            buildMetricEntry('Top-1', 0.5),
            buildMetricEntry('Top-5', 0.5),
            buildMetricEntry('Top-10', 0.5),
        ]
        const result = filterPlateauMetrics(metrics)
        expect(result[0].name).toBe('Solvability')
        expect(result).toHaveLength(3) // Solvability + Top-1 + Top-5
    })

    it('returns empty array for empty input', () => {
        expect(filterPlateauMetrics([])).toEqual([])
    })

    it('(property) output length is never greater than input length', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        name: fc.oneof(
                            fc.constant('Solvability'),
                            fc.integer({ min: 1, max: 100 }).map((k) => `Top-${k}`)
                        ),
                        value: fc.double({ min: 0, max: 1, noNaN: true }),
                    }),
                    { minLength: 0, maxLength: 15 }
                ),
                (items) => {
                    // Deduplicate Top-k names to avoid identical metric names
                    const seen = new Set<string>()
                    const uniqueItems = items.filter((item) => {
                        if (seen.has(item.name)) return false
                        seen.add(item.name)
                        return true
                    })

                    const metrics = uniqueItems.map((item) => buildMetricEntry(item.name, item.value))
                    const result = filterPlateauMetrics(metrics)
                    return result.length <= metrics.length
                }
            )
        )
    })
})

// ============================================================================
// filterPlateauStratifiedMetrics
// ============================================================================

function buildStratifiedEntry(name: string, overallValue: number): { name: string; stratified: StratifiedMetric } {
    return {
        name,
        stratified: {
            metricName: name,
            overall: {
                value: overallValue,
                ciLower: overallValue - 0.05,
                ciUpper: overallValue + 0.05,
                nSamples: 100,
                reliability: { code: 'OK', message: 'OK' },
            },
            byGroup: {},
        },
    }
}

describe('filterPlateauStratifiedMetrics', () => {
    it('filters plateau values the same way as filterPlateauMetrics', () => {
        const metrics = [
            buildStratifiedEntry('Top-1', 0.3),
            buildStratifiedEntry('Top-5', 0.6),
            buildStratifiedEntry('Top-10', 0.6),
            buildStratifiedEntry('Top-20', 0.6),
            buildStratifiedEntry('Top-50', 0.6),
        ]
        const result = filterPlateauStratifiedMetrics(metrics)
        expect(result.map((m) => m.name)).toEqual(['Top-1', 'Top-5', 'Top-10'])
    })
})

// ============================================================================
// formatBibtex
// ============================================================================

describe('formatBibtex', () => {
    it('formats a single-line bibtex string into multiline', () => {
        const input = '@article{smith2024, author={Smith}, title={Test}, year={2024}}'
        const result = formatBibtex(input)

        expect(result).toContain('\n')
        expect(result).toMatch(/^@article\{smith2024,/)
        expect(result).toMatch(/\n\}$/)
    })

    it('handles already-formatted bibtex gracefully', () => {
        const input = '@article{key,\n    author={A},\n    title={T}\n}'
        const result = formatBibtex(input)
        expect(result).toContain('@article{key,')
    })
})
