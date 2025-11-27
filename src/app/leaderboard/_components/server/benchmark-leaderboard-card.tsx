import type { LeaderboardEntry } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { BenchmarkMetricsDisplay } from '../client/benchmark-metrics-display'

type BenchmarkLeaderboardCardProps = {
    benchmarkId: string
    benchmarkName: string
    hasGroundTruth: boolean
    entries: LeaderboardEntry[]
}

/**
 * Server component that displays leaderboard for a single benchmark.
 * Shows overall metrics with table/chart toggle in a single consolidated card.
 *
 * Following App Router Manifesto:
 * - Server component fetches data
 * - Client component handles view toggle and Top-K selection (local state)
 */
export async function BenchmarkLeaderboardCard({
    benchmarkName,
    hasGroundTruth,
    entries,
}: BenchmarkLeaderboardCardProps) {
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
        <Card>
            <CardHeader>
                <CardTitle>{benchmarkName}</CardTitle>
                <CardDescription>
                    Model performance comparison{!hasGroundTruth && ' (solvability only)'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {/* Client component handles table/chart toggle and Top-K selection */}
                <BenchmarkMetricsDisplay entries={entries} topKMetricNames={sortedTopKNames} />
            </CardContent>
        </Card>
    )
}
