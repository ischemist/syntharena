import { Suspense } from 'react'
import type { Metadata } from 'next'

import { getBenchmarkSets } from '@/lib/services/view/benchmark.view'
import { getLeaderboardPageData } from '@/lib/services/view/leaderboard.view'

import { PageLevelTopKSelector } from './_components/client/page-level-top-k-selector'
import { StratifiedMetricsFilter } from './_components/client/stratified-metrics-filter'
import { BenchmarkLeaderboardHeader } from './_components/server/benchmark-leaderboard-header'
import { BenchmarkLeaderboardOverall } from './_components/server/benchmark-leaderboard-overall'
import { StratifiedMetricCard } from './_components/server/stratified-metric-card'
import { LeaderboardCardSkeleton } from './_components/skeletons'

export const metadata: Metadata = {
    title: 'Leaderboard',
    description: 'Compare model performance across retrosynthesis benchmarks.',
}

type LeaderboardPageProps = {
    searchParams: Promise<{ benchmarkId?: string }>
}

/**
 * Leaderboard page for comparing model performance across benchmarks.
 * Uses URL state (searchParams) to show selected benchmark.
 *
 * Following App Router Manifesto:
 * - Page is NOT async - defines structure and Suspense boundaries only
 * - All data fetching pushed to child server components
 * - URL state for benchmark selection (shareable, refresh-safe)
 * - searchParams is async in Next.js 15+
 */
export default function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
    return (
        <div className="flex flex-col gap-6">
            {/* Benchmark Header with Selector */}
            <Suspense fallback={<LeaderboardCardSkeleton />}>
                <BenchmarkHeaderWrapper searchParams={searchParams} />
            </Suspense>

            {/* Page-Level Top-K Selector + Content */}
            <Suspense fallback={<LeaderboardCardSkeleton />}>
                <LeaderboardContent searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

/**
 * Helper function to get the effective benchmark ID (from URL or default).
 */
async function getEffectiveBenchmarkId(searchParams: Promise<{ benchmarkId?: string }>): Promise<string | null> {
    const params = await searchParams

    // If benchmark is specified in URL, use it
    if (params.benchmarkId) {
        return params.benchmarkId
    }

    // Otherwise, get the first available benchmark
    const benchmarks = await getBenchmarkSets()
    if (benchmarks.length === 0) {
        return null
    }

    // Sort benchmarks by name to ensure a stable default
    benchmarks.sort((a, b) => a.name.localeCompare(b.name))
    return benchmarks[0].id
}

/**
 * Wrapper to display benchmark header with selector.
 */
async function BenchmarkHeaderWrapper({ searchParams }: { searchParams: Promise<{ benchmarkId?: string }> }) {
    const benchmarkId = await getEffectiveBenchmarkId(searchParams)
    const benchmarks = await getBenchmarkSets()

    // Handle no benchmarks available
    if (!benchmarkId || benchmarks.length === 0) {
        return (
            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
                <p>No benchmarks available.</p>
                <p className="mt-2 text-sm">Create a benchmark to see leaderboard data.</p>
            </div>
        )
    }

    // Transform to simpler format for combobox
    const benchmarkOptions = benchmarks.map((b) => ({
        id: b.id,
        name: b.name,
    }))

    return <BenchmarkLeaderboardHeader benchmarkId={benchmarkId} benchmarks={benchmarkOptions} />
}

/**
 * [REFACTORED] Server component that wraps all metrics content.
 * Optimized: Fetches all leaderboard and stratified data in a single, unified query.
 */
async function LeaderboardContent({ searchParams }: { searchParams: Promise<{ benchmarkId?: string }> }) {
    const benchmarkId = await getEffectiveBenchmarkId(searchParams)

    // Handle no benchmarks available
    if (!benchmarkId) {
        return null
    }

    // OPTIMIZATION: Single, unified query for all page data
    const pageData = await getLeaderboardPageData(benchmarkId)

    if (!pageData) {
        return (
            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
                <p>No leaderboard data available for this benchmark.</p>
                <p className="mt-2 text-sm">Load model predictions and statistics to see comparisons.</p>
            </div>
        )
    }

    const { leaderboardEntries, stratifiedMetricsByStock, stocks, metadata } = pageData
    const { hasAcceptableRoutes, availableTopKMetrics } = metadata

    // Get stock name from first entry (all entries share same benchmark/stock for overall view)
    const stockName = leaderboardEntries[0].stockName

    // If no acceptable routes, render without Top-K selector
    if (!hasAcceptableRoutes || availableTopKMetrics.length === 0) {
        return (
            <div className="flex flex-col gap-6">
                <BenchmarkLeaderboardOverall
                    entries={leaderboardEntries}
                    hasAcceptableRoutes={hasAcceptableRoutes}
                    stockName={stockName}
                    topKMetricNames={[]}
                />
                <Suspense fallback={<LeaderboardCardSkeleton />}>
                    <StratifiedMetricsWrapper
                        metricsByStock={stratifiedMetricsByStock}
                        stocks={stocks}
                        metricNames={['Solvability']}
                    />
                </Suspense>
            </div>
        )
    }

    return (
        <PageLevelTopKSelector topKMetricNames={availableTopKMetrics}>
            <div className="flex flex-col gap-6">
                {/* Overall Metrics */}
                <BenchmarkLeaderboardOverall
                    entries={leaderboardEntries}
                    hasAcceptableRoutes={hasAcceptableRoutes}
                    stockName={stockName}
                    topKMetricNames={availableTopKMetrics}
                />

                {/* Stratified Metrics by Route Length */}
                <Suspense fallback={<LeaderboardCardSkeleton />}>
                    <StratifiedMetricsWrapper
                        metricsByStock={stratifiedMetricsByStock}
                        stocks={stocks}
                        metricNames={['Solvability', ...availableTopKMetrics]}
                    />
                </Suspense>
            </div>
        </PageLevelTopKSelector>
    )
}

/**
 * [REFACTORED] Server component that renders stratified metric cards.
 * Now a "dumb" component that receives pre-computed data.
 */
function StratifiedMetricsWrapper({
    metricsByStock,
    stocks,
    metricNames,
}: {
    metricsByStock: NonNullable<Awaited<ReturnType<typeof getLeaderboardPageData>>>['stratifiedMetricsByStock']
    stocks: NonNullable<Awaited<ReturnType<typeof getLeaderboardPageData>>>['stocks']
    metricNames: string[]
}) {
    if (stocks.length === 0) {
        return null
    }

    return (
        <>
            {stocks.map((stock) => {
                const stockMetrics = metricsByStock.get(stock.id)
                if (!stockMetrics) return null

                return (
                    <div key={stock.id} className="flex flex-col gap-6">
                        {/* If multiple stocks, add a header here */}
                        {stocks.length > 1 && <h2 className="text-xl font-semibold">{stock.name} Metrics</h2>}

                        {metricNames.map((metricName) => (
                            <StratifiedMetricsFilter key={`${stock.id}-${metricName}`} metricName={metricName}>
                                <StratifiedMetricCard metricName={metricName} metricsMap={stockMetrics} />
                            </StratifiedMetricsFilter>
                        ))}
                    </div>
                )
            })}
        </>
    )
}
