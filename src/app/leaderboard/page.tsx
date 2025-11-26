import { Suspense } from 'react'

import { ViewToggle } from './_components/client/view-toggle'
import { LeaderboardFilters } from './_components/server/leaderboard-filters'
import { OverallLeaderboardTable } from './_components/server/overall-leaderboard-table'
import { OverallMetricsChartWrapper } from './_components/server/overall-metrics-chart-wrapper'
import { StratifiedMetricsTable } from './_components/server/stratified-metrics-table'
import {
    LeaderboardChartSkeleton,
    LeaderboardFiltersSkeleton,
    LeaderboardTableSkeleton,
    StratifiedMetricsSkeleton,
} from './_components/skeletons'

type PageProps = {
    searchParams: Promise<{
        benchmark?: string
        stock?: string
        view?: 'table' | 'chart'
        stratified?: string
    }>
}

/**
 * Leaderboard page for comparing model performance across benchmarks.
 * All state is managed via URL searchParams (server-rendered).
 */
export default async function LeaderboardPage({ searchParams }: PageProps) {
    const params = await searchParams
    const benchmarkId = params.benchmark
    const stockId = params.stock
    const view = params.view || 'table'
    const showStratified = params.stratified === 'true'

    return (
        <div className="flex flex-col gap-6">
            {/* Page Header */}
            <div>
                <h1 className="mb-2 text-3xl font-bold">Leaderboard</h1>
                <p className="text-muted-foreground">Compare model performance across benchmarks</p>
            </div>

            {/* Filters */}
            <Suspense fallback={<LeaderboardFiltersSkeleton />}>
                <LeaderboardFilters selectedBenchmarkId={benchmarkId} selectedStockId={stockId} />
            </Suspense>

            {/* View Toggle */}
            <ViewToggle />

            {/* Overall Leaderboard - Table or Chart View */}
            <Suspense
                key={`leaderboard-${view}-${benchmarkId || 'all'}-${stockId || 'all'}`}
                fallback={view === 'chart' ? <LeaderboardChartSkeleton /> : <LeaderboardTableSkeleton />}
            >
                {view === 'chart' ? (
                    <OverallMetricsChartWrapper benchmarkId={benchmarkId} stockId={stockId} />
                ) : (
                    <OverallLeaderboardTable benchmarkId={benchmarkId} stockId={stockId} />
                )}
            </Suspense>

            {/* Stratified Metrics - Only shown when single benchmark + stock selected */}
            {benchmarkId && stockId && (
                <Suspense key={`stratified-${benchmarkId}-${stockId}`} fallback={<StratifiedMetricsSkeleton />}>
                    <StratifiedMetricsTable benchmarkId={benchmarkId} stockId={stockId} />
                </Suspense>
            )}
        </div>
    )
}
