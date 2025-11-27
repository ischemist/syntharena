import { Suspense } from 'react'

import type { LeaderboardEntry } from '@/types'
import { getMetricsByBenchmarkAndStock } from '@/lib/services/leaderboard.service'
import { getStocks } from '@/lib/services/stock.service'
import { MetricCell } from '@/components/metrics'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

import { BenchmarkMetricsWrapper } from '../client/benchmark-metrics-wrapper'
import { StratifiedMetricsSection } from '../client/stratified-metrics-section'

type BenchmarkLeaderboardCardProps = {
    benchmarkId: string
    benchmarkName: string
    hasGroundTruth: boolean
    entries: LeaderboardEntry[]
}

/**
 * Server component that displays leaderboard for a single benchmark.
 * Shows overall metrics and stratified metrics in a single consolidated card.
 *
 * Following App Router Manifesto:
 * - Server component fetches data and defines structure
 * - Client wrapper component handles Top-K selection (local state)
 * - Passes data as props to client wrapper, not render functions
 */
export async function BenchmarkLeaderboardCard({
    benchmarkId,
    benchmarkName,
    hasGroundTruth,
    entries,
}: BenchmarkLeaderboardCardProps) {
    // Get all stocks for stratified metrics
    const stocks = await getStocks()

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

    // Get stock name for description (assuming single stock per benchmark)
    const stockName = stocks.length > 0 ? stocks[0].name : ''

    return (
        <Card>
            <CardHeader>
                <CardTitle>{benchmarkName}</CardTitle>
                <CardDescription>
                    Model performance comparison for {stockName}
                    {!hasGroundTruth && ' (solvability only)'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {/* Client wrapper manages Top-K selection and passes data to children */}
                <BenchmarkMetricsWrapper
                    topKMetricNames={sortedTopKNames}
                    entries={entries}
                    stratifiedSections={
                        <>
                            {stocks.map((stock) => (
                                <Suspense
                                    key={`${benchmarkId}-${stock.id}`}
                                    fallback={
                                        <div>
                                            <Skeleton className="mb-4 h-6 w-64" />
                                            <Skeleton className="h-64 w-full" />
                                        </div>
                                    }
                                >
                                    <StratifiedMetricsWrapper benchmarkId={benchmarkId} stockId={stock.id} />
                                </Suspense>
                            ))}
                        </>
                    }
                />
            </CardContent>
        </Card>
    )
}

/**
 * Async wrapper that fetches stratified metrics for a benchmark-stock combination.
 */
async function StratifiedMetricsWrapper({ benchmarkId, stockId }: { benchmarkId: string; stockId: string }) {
    const metricsMap = await getMetricsByBenchmarkAndStock(benchmarkId, stockId)

    if (metricsMap.size === 0) {
        return null
    }

    return <StratifiedMetricsSection metricsMap={metricsMap} MetricCell={MetricCell} />
}
