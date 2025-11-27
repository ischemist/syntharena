import { Suspense } from 'react'

import { getMetricsByBenchmarkAndStock } from '@/lib/services/leaderboard.service'
import { getStocks } from '@/lib/services/stock.service'
import { MetricCell } from '@/components/metrics'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

import { StratifiedMetricsSection } from '../client/stratified-metrics-section'
import { TopKSelectorWrapper } from '../client/top-k-selector'

type BenchmarkLeaderboardStratifiedProps = {
    benchmarkId: string
    topKMetricNames: string[]
}

/**
 * Server component that displays stratified metrics by route length in a bordered card.
 * Shows performance breakdown across route lengths for all models and stocks.
 * Following App Router Manifesto:
 * - Server component fetches stock data and defines structure
 * - Delegates per-stock data fetching to async wrappers in Suspense boundaries
 */
export async function BenchmarkLeaderboardStratified({
    benchmarkId,
    topKMetricNames,
}: BenchmarkLeaderboardStratifiedProps) {
    // Get all stocks to fetch stratified metrics for each
    const stocks = await getStocks()

    if (stocks.length === 0) {
        return null
    }

    return (
        <Card variant="bordered">
            <CardHeader>
                <CardTitle>Metrics by Route Length</CardTitle>
                <CardDescription>Performance breakdown by ground truth route length across all stocks</CardDescription>
            </CardHeader>
            <CardContent>
                {topKMetricNames.length > 0 ? (
                    <TopKSelectorWrapper topKMetricNames={topKMetricNames}>
                        <div className="space-y-8">
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
                                    <StratifiedMetricsWrapper
                                        benchmarkId={benchmarkId}
                                        stockId={stock.id}
                                        stockName={stock.name}
                                    />
                                </Suspense>
                            ))}
                        </div>
                    </TopKSelectorWrapper>
                ) : (
                    <div className="space-y-8">
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
                                <StratifiedMetricsWrapper
                                    benchmarkId={benchmarkId}
                                    stockId={stock.id}
                                    stockName={stock.name}
                                />
                            </Suspense>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

/**
 * Async wrapper that fetches stratified metrics for a benchmark-stock combination.
 */
async function StratifiedMetricsWrapper({
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

    return (
        <div>
            <h4 className="mb-4 text-base font-semibold">{stockName}</h4>
            <StratifiedMetricsSection metricsMap={metricsMap} MetricCell={MetricCell} />
        </div>
    )
}
