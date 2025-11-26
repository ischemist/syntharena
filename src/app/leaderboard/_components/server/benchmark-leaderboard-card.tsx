import { Suspense } from 'react'

import type { LeaderboardEntry } from '@/types'
import { getMetricsByBenchmarkAndStock } from '@/lib/services/leaderboard.service'
import { getStocks } from '@/lib/services/stock.service'
import { StratifiedMetricsTable } from '@/components/metrics'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { BenchmarkMetricsDisplay } from '../client/benchmark-metrics-display'
import { StratifiedMetricsSkeleton } from '../skeletons'

type BenchmarkLeaderboardCardProps = {
    benchmarkId: string
    benchmarkName: string
    hasGroundTruth: boolean
    entries: LeaderboardEntry[]
}

/**
 * Server component that displays leaderboard for a single benchmark.
 * Shows overall metrics with table/chart toggle, and optional stratified metrics.
 *
 * Following App Router Manifesto:
 * - Server component fetches data
 * - Client component handles view toggle (local state)
 * - Suspense boundary for stratified metrics
 */
export async function BenchmarkLeaderboardCard({
    benchmarkId,
    benchmarkName,
    hasGroundTruth,
    entries,
}: BenchmarkLeaderboardCardProps) {
    // Get stocks for display
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

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>{benchmarkName}</CardTitle>
                    <CardDescription>
                        Model performance comparison{!hasGroundTruth && ' (solvability only)'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Client component handles table/chart toggle */}
                    <BenchmarkMetricsDisplay entries={entries} topKMetricNames={sortedTopKNames} />
                </CardContent>
            </Card>

            {/* Stratified metrics - one section per stock */}
            {stocks.map((stock) => (
                <Suspense key={`${benchmarkId}-${stock.id}`} fallback={<StratifiedMetricsSkeleton />}>
                    <StratifiedMetricsSection benchmarkId={benchmarkId} stockId={stock.id} stockName={stock.name} />
                </Suspense>
            ))}
        </div>
    )
}

/**
 * Async server component that fetches and displays stratified metrics for a benchmark-stock combination.
 */
async function StratifiedMetricsSection({
    benchmarkId,
    stockId,
    stockName,
}: {
    benchmarkId: string
    stockId: string
    stockName: string
}) {
    const metricsMap = await getMetricsByBenchmarkAndStock(benchmarkId, stockId)

    if (metricsMap.size === 0) {
        return null
    }

    // Dynamically import MetricCell to avoid circular dependency
    const { MetricCell } = await import('@/app/runs/[runId]/_components/client/metric-cell')

    return (
        <div>
            <h3 className="mb-4 text-lg font-semibold">Stratified Metrics - {stockName}</h3>
            <StratifiedMetricsTable metricsMap={metricsMap} MetricCellComponent={MetricCell} />
        </div>
    )
}
