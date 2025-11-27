import { Suspense } from 'react'
import type { Metadata } from 'next'

import { getBenchmarkSets } from '@/lib/services/benchmark.service'
import { getLeaderboard, getMetricsByBenchmarkAndStock } from '@/lib/services/leaderboard.service'
import { getStocks } from '@/lib/services/stock.service'
import { Skeleton } from '@/components/ui/skeleton'

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
 * Server component that wraps all metrics content with page-level Top-K selector.
 */
async function LeaderboardContent({ searchParams }: { searchParams: Promise<{ benchmarkId?: string }> }) {
    const benchmarkId = await getEffectiveBenchmarkId(searchParams)

    // Handle no benchmarks available
    if (!benchmarkId) {
        return null
    }

    // Get leaderboard data for the selected benchmark
    const entries = await getLeaderboard(benchmarkId)

    if (entries.length === 0) {
        return (
            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
                <p>No leaderboard data available for this benchmark.</p>
                <p className="mt-2 text-sm">Load model predictions and statistics to see comparisons.</p>
            </div>
        )
    }

    // Get stock name from first entry (all entries share same stock)
    const stockName = entries[0].stockName

    // Check if benchmark has ground truth (based on presence of topKAccuracy)
    const hasGroundTruth = entries.some((entry) => entry.metrics.topKAccuracy !== undefined)

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

    // If no ground truth, render without Top-K selector
    if (!hasGroundTruth || sortedTopKNames.length === 0) {
        return (
            <div className="flex flex-col gap-6">
                <BenchmarkLeaderboardOverall entries={entries} hasGroundTruth={hasGroundTruth} stockName={stockName} />
                <Suspense fallback={<LeaderboardCardSkeleton />}>
                    <StratifiedMetricsWrapper benchmarkId={benchmarkId} metricNames={['Solvability']} />
                </Suspense>
            </div>
        )
    }

    return (
        <PageLevelTopKSelector topKMetricNames={sortedTopKNames}>
            <div className="flex flex-col gap-6">
                {/* Overall Metrics */}
                <BenchmarkLeaderboardOverall entries={entries} hasGroundTruth={hasGroundTruth} stockName={stockName} />

                {/* Stratified Metrics by Route Length */}
                <Suspense fallback={<LeaderboardCardSkeleton />}>
                    <StratifiedMetricsWrapper
                        benchmarkId={benchmarkId}
                        metricNames={['Solvability', ...sortedTopKNames]}
                    />
                </Suspense>
            </div>
        </PageLevelTopKSelector>
    )
}

/**
 * Server component that renders stratified metric cards for each metric/stock combination.
 */
async function StratifiedMetricsWrapper({ benchmarkId, metricNames }: { benchmarkId: string; metricNames: string[] }) {
    const stocks = await getStocks()

    if (stocks.length === 0) {
        return null
    }

    return (
        <>
            {stocks.map((stock) => (
                <div key={stock.id} className="flex flex-col gap-6">
                    {metricNames.map((metricName) => (
                        <Suspense
                            key={`${stock.id}-${metricName}`}
                            fallback={
                                <div>
                                    <Skeleton className="mb-4 h-6 w-64" />
                                    <Skeleton className="h-64 w-full" />
                                </div>
                            }
                        >
                            <StratifiedMetricWrapper
                                benchmarkId={benchmarkId}
                                stockId={stock.id}
                                metricName={metricName}
                            />
                        </Suspense>
                    ))}
                </div>
            ))}
        </>
    )
}

/**
 * Async wrapper that fetches and renders a single stratified metric card.
 * Wrapped with StratifiedMetricsFilter to only show selected Top-K metrics.
 */
async function StratifiedMetricWrapper({
    benchmarkId,
    stockId,
    metricName,
}: {
    benchmarkId: string
    stockId: string
    metricName: string
}) {
    const metricsMap = await getMetricsByBenchmarkAndStock(benchmarkId, stockId)

    if (metricsMap.size === 0) {
        return null
    }

    return (
        <StratifiedMetricsFilter metricName={metricName}>
            <StratifiedMetricCard metricName={metricName} metricsMap={metricsMap} />
        </StratifiedMetricsFilter>
    )
}
