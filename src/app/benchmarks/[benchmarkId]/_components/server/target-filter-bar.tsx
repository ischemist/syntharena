import * as benchmarkService from '@/lib/services/benchmark.service'
import { Card, CardContent } from '@/components/ui/card'

import { TargetFilters } from '../client/target-filters'
import { TargetSearchBar } from '../client/target-search-bar'

interface TargetFilterBarProps {
    benchmarkId: string
}

/**
 * Server component that fetches benchmark stats and renders filter controls.
 * Displays search bar (always) and filter controls (only if benchmark has ground truth).
 * Handles data fetching so client components can focus on interactivity.
 */
export async function TargetFilterBar({ benchmarkId }: TargetFilterBarProps) {
    const stats = await benchmarkService.getBenchmarkStats(benchmarkId)

    const hasGroundTruth = stats.targetsWithGroundTruth > 0
    const minLength = stats.minRouteLength
    const maxLength = stats.maxRouteLength

    return (
        <Card>
            <CardContent className="pt-6">
                <div className="space-y-4">
                    {/* Search bar - always shown */}
                    <TargetSearchBar />

                    {/* Filters - only shown if benchmark has ground truth */}
                    {hasGroundTruth && (
                        <TargetFilters hasGroundTruth={hasGroundTruth} minLength={minLength} maxLength={maxLength} />
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
