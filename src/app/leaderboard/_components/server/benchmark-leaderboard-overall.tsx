import type { LeaderboardEntry } from '@/types'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import {
    BenchmarkMetricsDisplay,
    MetricsDisplayProvider,
    MetricsDisplayToggleButtons,
} from '../client/benchmark-metrics-display'

type BenchmarkLeaderboardOverallProps = {
    entries: LeaderboardEntry[]
    benchmarkSeries: LeaderboardEntry['benchmarkSeries']
    hasAcceptableRoutes: boolean
    metricLabel: string
    topKMetricNames: string[] // now receives this directly
}

/**
 * Server component that displays overall leaderboard metrics in a bordered card.
 * Shows Tier-0, Solv-0, and Top-K accuracy metrics with table/chart toggle.
 * Top-K selection is managed at page level, view toggle is in CardAction.
 * Following App Router Manifesto:
 * - Server component defines structure and passes data to client components
 * - Client component handles view toggling (local state via context)
 */
export function BenchmarkLeaderboardOverall({
    entries,
    benchmarkSeries,
    hasAcceptableRoutes,
    metricLabel,
    topKMetricNames,
}: BenchmarkLeaderboardOverallProps) {
    return (
        <MetricsDisplayProvider>
            <Card variant="bordered">
                <CardHeader>
                    <CardTitle>Overall Metrics</CardTitle>
                    <CardDescription>
                        Model performance comparison for Solv-0[{metricLabel}]
                        {!hasAcceptableRoutes && ' (Tier-0 and Solv-0 only)'}
                    </CardDescription>
                    <CardAction>
                        <MetricsDisplayToggleButtons />
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <BenchmarkMetricsDisplay
                        entries={entries}
                        benchmarkSeries={benchmarkSeries}
                        topKMetricNames={topKMetricNames}
                    />
                </CardContent>
            </Card>
        </MetricsDisplayProvider>
    )
}
