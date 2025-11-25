import * as benchmarkService from '@/lib/services/benchmark.service'

import { TargetSearchBar } from '../client/target-search-bar'

interface TargetFilterBarProps {
    benchmarkId: string
}

/**
 * Server component that fetches benchmark stats and renders compact filter toolbar.
 * Displays search and filter controls in a single row, shadcn datatable style.
 * Handles data fetching so client component can focus on interactivity.
 */
export async function TargetFilterBar({ benchmarkId }: TargetFilterBarProps) {
    const stats = await benchmarkService.getBenchmarkStats(benchmarkId)

    const hasGroundTruth = stats.targetsWithGroundTruth > 0
    const minLength = stats.minRouteLength
    const maxLength = stats.maxRouteLength

    return <TargetSearchBar hasGroundTruth={hasGroundTruth} minLength={minLength} maxLength={maxLength} />
}
