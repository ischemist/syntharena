/**
 * Types for breadcrumb navigation system.
 */

export interface BreadcrumbSegment {
    /** The URL segment (e.g., 'benchmarks', 'runs', or a UUID) */
    segment: string
    /** The display label for this segment */
    label: string
    /** The full href path to this segment */
    href: string
    /** Whether this is the current/last segment (not clickable) */
    isCurrent: boolean
}

/**
 * Configuration for static segment labels.
 * Maps URL segments to their display names.
 */
export const STATIC_SEGMENT_LABELS: Record<string, string> = {
    benchmarks: 'Benchmarks',
    runs: 'Runs',
    stocks: 'Stocks',
    leaderboard: 'Leaderboard',
    targets: 'Targets',
}

/**
 * Helper to check if a string looks like a UUID or database ID.
 */
export function isDynamicSegment(segment: string): boolean {
    // Check for UUID pattern (8-4-4-4-12 hex characters)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    // Check for cuid pattern (starts with 'c' followed by alphanumeric)
    const cuidPattern = /^c[a-z0-9]{24,}$/i
    // Check for other common ID patterns (alphanumeric, 20+ chars)
    const idPattern = /^[a-z0-9_-]{20,}$/i

    return uuidPattern.test(segment) || cuidPattern.test(segment) || idPattern.test(segment)
}

/**
 * Determines the entity type based on the preceding segment.
 * Used to resolve dynamic segment names.
 */
export function getEntityType(segments: string[], index: number): string | null {
    if (index === 0) return null

    const prevSegment = segments[index - 1]

    // Map preceding segments to entity types
    const entityTypeMap: Record<string, string> = {
        benchmarks: 'benchmark',
        runs: 'run',
        stocks: 'stock',
        targets: 'target',
    }

    return entityTypeMap[prevSegment] || null
}
