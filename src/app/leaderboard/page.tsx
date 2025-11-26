import { Suspense } from 'react'

import { getLeaderboardByBenchmark } from '@/lib/services/leaderboard.service'
import { getStocks } from '@/lib/services/stock.service'

import { StockFilter } from './_components/client/stock-filter'
import { BenchmarkLeaderboardCard } from './_components/server/benchmark-leaderboard-card'
import { LeaderboardCardSkeleton } from './_components/skeletons'

type PageProps = {
    searchParams: Promise<{
        stock?: string
    }>
}

/**
 * Leaderboard page for comparing model performance across benchmarks.
 * Shows one card per benchmark with integrated table/chart toggle.
 *
 * Following App Router Manifesto:
 * - Page is NOT async - defines structure and Suspense boundaries only
 * - All data fetching pushed to child server components
 * - Each benchmark card wrapped in Suspense for independent streaming
 * - Stock filter uses URL searchParams (canonical state)
 */
export default function LeaderboardPage({ searchParams }: PageProps) {
    return (
        <div className="flex flex-col gap-6">
            {/* Page Header */}
            <div>
                <h1 className="mb-2 text-3xl font-bold">Leaderboard</h1>
                <p className="text-muted-foreground">Compare model performance across benchmarks</p>
            </div>

            {/* Stock Filter */}
            <Suspense fallback={<div className="bg-muted h-10 animate-pulse rounded" />}>
                <StockFilterWrapper searchParams={searchParams} />
            </Suspense>

            {/* Benchmark Cards */}
            <Suspense fallback={<LeaderboardCardSkeleton />}>
                <BenchmarkCards searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

/**
 * Server component that fetches stocks and renders stock filter.
 */
async function StockFilterWrapper({ searchParams }: PageProps) {
    const params = await searchParams
    const stocks = await getStocks()

    return <StockFilter stocks={stocks} selectedStockId={params.stock} />
}

/**
 * Server component that fetches leaderboard data and renders benchmark cards.
 */
async function BenchmarkCards({ searchParams }: PageProps) {
    const params = await searchParams
    const stockId = params.stock

    // Get leaderboard data grouped by benchmark
    const benchmarkGroups = await getLeaderboardByBenchmark(stockId)

    if (benchmarkGroups.size === 0) {
        return (
            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
                <p>No leaderboard data available.</p>
                <p className="mt-2 text-sm">Load model predictions and statistics to see comparisons.</p>
            </div>
        )
    }

    // Render one card per benchmark
    return (
        <div className="space-y-8">
            {Array.from(benchmarkGroups.values()).map((group) => (
                <Suspense key={group.benchmarkId} fallback={<LeaderboardCardSkeleton />}>
                    <BenchmarkLeaderboardCard
                        benchmarkId={group.benchmarkId}
                        benchmarkName={group.benchmarkName}
                        hasGroundTruth={group.hasGroundTruth}
                        entries={group.entries}
                    />
                </Suspense>
            ))}
        </div>
    )
}
