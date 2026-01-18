import type { BenchmarkStats } from '@/types'

import { TargetSearchBar } from '../client/target-search-bar'

interface TargetFilterBarProps {
    stats: BenchmarkStats
}

/**
 * Synchronous component that passes pre-fetched benchmark stats to the client-side filter toolbar.
 */
export function TargetFilterBar({ stats }: TargetFilterBarProps) {
    const hasAcceptableRoutes = stats.targetsWithAcceptableRoutes > 0
    const minLength = stats.minRouteLength
    const maxLength = stats.maxRouteLength

    return <TargetSearchBar hasAcceptableRoutes={hasAcceptableRoutes} minLength={minLength} maxLength={maxLength} />
}
