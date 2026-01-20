import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import type { MetricResult, StratifiedMetric, Versionable } from '@/types'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Safely formats an unknown error value to a string for logging/display.
 * Handles Error objects, strings, and other types appropriately.
 */
export function formatError(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }
    return String(error)
}

/**
 * Extracts the k value from a Top-k metric name.
 * @example extractTopK("Top-10") => 10
 * @example extractTopK("Solvability") => null
 */
function extractTopK(name: string): number | null {
    const match = name.match(/^Top-(\d+)$/i)
    return match ? parseInt(match[1]) : null
}

/**
 * Checks if two metric values are effectively equal within a small tolerance.
 * Uses epsilon comparison to handle floating-point precision issues.
 */
function valuesEqual(a: number, b: number, epsilon = 0.0001): boolean {
    return Math.abs(a - b) < epsilon
}

/**
 * Filters out duplicate plateau values in Top-k metrics.
 *
 * When Top-k metrics plateau (e.g., Top-10, Top-20, Top-50 all have the same value),
 * this function keeps only the first 2 occurrences of each plateau value.
 *
 * Non-Top-k metrics (e.g., "Solvability") are passed through unchanged.
 *
 * @example
 * Input: [
 *   { name: "Solvability", metric: { value: 0.8 } },
 *   { name: "Top-1", metric: { value: 0.3 } },
 *   { name: "Top-5", metric: { value: 0.5 } },
 *   { name: "Top-10", metric: { value: 0.6 } },
 *   { name: "Top-20", metric: { value: 0.6 } },  // Same as Top-10
 *   { name: "Top-50", metric: { value: 0.6 } },  // Same as Top-10 and Top-20
 *   { name: "Top-100", metric: { value: 0.6 } }, // Same as Top-10, Top-20, Top-50
 * ]
 *
 * Output: [
 *   { name: "Solvability", metric: { value: 0.8 } },
 *   { name: "Top-1", metric: { value: 0.3 } },
 *   { name: "Top-5", metric: { value: 0.5 } },
 *   { name: "Top-10", metric: { value: 0.6 } },
 *   { name: "Top-20", metric: { value: 0.6 } },  // Kept (2nd occurrence)
 *   // Top-50 and Top-100 removed (3rd and 4th occurrences)
 * ]
 */
export function filterPlateauMetrics<T extends { name: string; metric: MetricResult }>(metrics: T[]): T[] {
    // Separate Top-k from other metrics
    const topKMetrics: Array<T & { k: number }> = []
    const otherMetrics: T[] = []

    for (const metric of metrics) {
        const k = extractTopK(metric.name)
        if (k !== null) {
            topKMetrics.push({ ...metric, k })
        } else {
            otherMetrics.push(metric)
        }
    }

    // Sort Top-k metrics by k value
    topKMetrics.sort((a, b) => a.k - b.k)

    // Filter out plateau duplicates (keep first 2 occurrences)
    const filteredTopK: T[] = []
    let plateauCount = 0
    let lastValue: number | null = null

    for (const metric of topKMetrics) {
        const currentValue = metric.metric.value

        if (lastValue !== null && valuesEqual(currentValue, lastValue)) {
            // We're in a plateau
            plateauCount++
            if (plateauCount < 2) {
                // Keep first 2 occurrences of plateau value
                filteredTopK.push(metric)
            }
            // Otherwise skip (3rd, 4th, etc. occurrence)
        } else {
            // New value, reset plateau counter
            plateauCount = 0
            lastValue = currentValue
            filteredTopK.push(metric)
        }
    }

    // Recombine: preserve original order by finding position of first Top-k metric
    const result: T[] = []
    let topKIndex = 0

    for (const metric of metrics) {
        const k = extractTopK(metric.name)
        if (k !== null) {
            // This is a Top-k metric - check if it's in our filtered list
            if (topKIndex < filteredTopK.length) {
                const filteredMetric = filteredTopK[topKIndex]
                if (filteredMetric.name === metric.name) {
                    result.push(filteredMetric)
                    topKIndex++
                }
                // If names don't match, this metric was filtered out - skip it
            }
        } else {
            // Not a Top-k metric, keep as-is
            result.push(metric)
        }
    }

    return result
}

/**
 * Filters out duplicate plateau values in stratified Top-k metrics.
 * Similar to filterPlateauMetrics but works with StratifiedMetric objects.
 */
export function filterPlateauStratifiedMetrics<T extends { name: string; stratified: StratifiedMetric }>(
    metrics: T[]
): T[] {
    // Separate Top-k from other metrics
    const topKMetrics: Array<T & { k: number }> = []
    const otherMetrics: T[] = []

    for (const metric of metrics) {
        const k = extractTopK(metric.name)
        if (k !== null) {
            topKMetrics.push({ ...metric, k })
        } else {
            otherMetrics.push(metric)
        }
    }

    // Sort Top-k metrics by k value
    topKMetrics.sort((a, b) => a.k - b.k)

    // Filter out plateau duplicates (keep first 2 occurrences)
    // Compare using overall metric value
    const filteredTopK: T[] = []
    let plateauCount = 0
    let lastValue: number | null = null

    for (const metric of topKMetrics) {
        const currentValue = metric.stratified.overall.value

        if (lastValue !== null && valuesEqual(currentValue, lastValue)) {
            // We're in a plateau
            plateauCount++
            if (plateauCount < 2) {
                // Keep first 2 occurrences of plateau value
                filteredTopK.push(metric)
            }
            // Otherwise skip (3rd, 4th, etc. occurrence)
        } else {
            // New value, reset plateau counter
            plateauCount = 0
            lastValue = currentValue
            filteredTopK.push(metric)
        }
    }

    // Recombine: preserve original order by finding position of first Top-k metric
    const result: T[] = []
    let topKIndex = 0

    for (const metric of metrics) {
        const k = extractTopK(metric.name)
        if (k !== null) {
            // This is a Top-k metric - check if it's in our filtered list
            if (topKIndex < filteredTopK.length) {
                const filteredMetric = filteredTopK[topKIndex]
                if (filteredMetric.name === metric.name) {
                    result.push(filteredMetric)
                    topKIndex++
                }
                // If names don't match, this metric was filtered out - skip it
            }
        } else {
            // Not a Top-k metric, keep as-is
            result.push(metric)
        }
    }

    return result
}

// ============================================================================
// NEW: Canonical Version Utilities
// ============================================================================

/**
 * Formats a Versionable object into a standard string (e.g., "v1.2.0-beta").
 * This is the SINGLE source of truth for version display.
 * @param version - An object matching the Versionable interface.
 * @returns A formatted version string.
 */
export function formatVersion(version: Versionable): string {
    const base = `v${version.versionMajor}.${version.versionMinor}.${version.versionPatch}`
    return version.versionPrerelease ? `${base}-${version.versionPrerelease}` : base
}

/**
 * Compares two Versionable objects according to SemVer precedence.
 * Returns > 0 if a > b, < 0 if a < b, 0 if equal.
 * Suitable for use in Array.prototype.sort().
 * @param a - The first version object.
 * @param b - The second version object.
 * @returns A number indicating the sort order.
 */
export function compareVersions(a: Versionable, b: Versionable): number {
    const majorDiff = a.versionMajor - b.versionMajor
    if (majorDiff !== 0) return majorDiff

    const minorDiff = a.versionMinor - b.versionMinor
    if (minorDiff !== 0) return minorDiff

    const patchDiff = a.versionPatch - b.versionPatch
    if (patchDiff !== 0) return patchDiff

    // Pre-release tag comparison:
    // A version with a pre-release tag has lower precedence than a normal version.
    // e.g., 1.0.0 > 1.0.0-beta
    if (a.versionPrerelease === null && b.versionPrerelease !== null) return 1
    if (a.versionPrerelease !== null && b.versionPrerelease === null) return -1
    if (a.versionPrerelease !== null && b.versionPrerelease !== null) {
        return a.versionPrerelease.localeCompare(b.versionPrerelease)
    }

    return 0
}
