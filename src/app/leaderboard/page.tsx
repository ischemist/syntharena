import { Suspense } from 'react'
import type { Metadata } from 'next'

import { getBenchmarkSets } from '@/lib/services/benchmark.service'
import { getLeaderboard } from '@/lib/services/leaderboard.service'

import { BenchmarkLeaderboardHeader } from './_components/server/benchmark-leaderboard-header'
import { BenchmarkLeaderboardOverall } from './_components/server/benchmark-leaderboard-overall'
import { BenchmarkLeaderboardStratified } from './_components/server/benchmark-leaderboard-stratified'
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

            {/* Overall Metrics */}
            <Suspense fallback={<LeaderboardCardSkeleton />}>
                <OverallMetricsDisplay searchParams={searchParams} />
            </Suspense>

            {/* Stratified Metrics by Route Length */}
            <Suspense fallback={<LeaderboardCardSkeleton />}>
                <StratifiedMetricsDisplay searchParams={searchParams} />
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
 * Server component that fetches and displays overall metrics for the selected benchmark.
 */
async function OverallMetricsDisplay({ searchParams }: { searchParams: Promise<{ benchmarkId?: string }> }) {
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

    return <BenchmarkLeaderboardOverall entries={entries} hasGroundTruth={hasGroundTruth} stockName={stockName} />
}

/**
 * Server component that fetches and displays stratified metrics for the selected benchmark.
 */
async function StratifiedMetricsDisplay({ searchParams }: { searchParams: Promise<{ benchmarkId?: string }> }) {
    const benchmarkId = await getEffectiveBenchmarkId(searchParams)

    // Handle no benchmarks available
    if (!benchmarkId) {
        return null
    }

    // Get leaderboard data to determine available Top-K metrics
    const entries = await getLeaderboard(benchmarkId)

    if (entries.length === 0) {
        return null
    }

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

    return <BenchmarkLeaderboardStratified benchmarkId={benchmarkId} topKMetricNames={sortedTopKNames} />
}
