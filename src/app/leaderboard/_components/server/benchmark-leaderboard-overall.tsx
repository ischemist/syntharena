import type { LeaderboardEntry } from '@/types'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import {
    BenchmarkMetricsDisplay,
    MetricsViewProvider,
    MetricsViewToggleButtons,
} from '../client/benchmark-metrics-display'

type BenchmarkLeaderboardOverallProps = {
    entries: LeaderboardEntry[]
    hasGroundTruth: boolean
    stockName: string
}

/**
 * Server component that displays overall leaderboard metrics in a bordered card.
 * Shows solvability and Top-K accuracy metrics with table/chart toggle.
 * Top-K selection is managed at page level, view toggle is in CardAction.
 * Following App Router Manifesto:
 * - Server component defines structure and passes data to client components
 * - Client component handles view toggling (local state via context)
 */
export function BenchmarkLeaderboardOverall({ entries, hasGroundTruth, stockName }: BenchmarkLeaderboardOverallProps) {
    // Determine which Top-K metrics to show (collect all unique keys)
    const topKMetricNames = new Set<string>()
    entries.forEach((entry) => {
        if (entry.metrics.topKAccuracy) {
            Object.keys(entry.metrics.topKAccuracy).forEach((k) => topKMetricNames.add(k))
        }
    })

    // Sort Top-K metric names numerically (Top-1, Top-5, Top-10, etc.)
    const sortedTopKNames = Array.from(topKMetricNames).sort((a, b) => {
        const aNum = parseInt(a.replace(/^\D+/, ''))
        const bNum = parseInt(b.replace(/^\D+/, ''))
        return aNum - bNum
    })

    return (
        <MetricsViewProvider>
            <Card variant="bordered">
                <CardHeader>
                    <CardTitle>Overall Metrics</CardTitle>
                    <CardDescription>
                        Model performance comparison for {stockName}
                        {!hasGroundTruth && ' (solvability only)'}
                    </CardDescription>
                    <CardAction>
                        <MetricsViewToggleButtons />
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <BenchmarkMetricsDisplay entries={entries} topKMetricNames={sortedTopKNames} />
                </CardContent>
            </Card>
        </MetricsViewProvider>
    )
}
