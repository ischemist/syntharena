import { Suspense } from 'react'

import { getBenchmarkSets } from '@/lib/services/benchmark.service'
import { getLeaderboard } from '@/lib/services/leaderboard.service'
import { Skeleton } from '@/components/ui/skeleton'

import { BenchmarkLeaderboardCard } from './_components/server/benchmark-leaderboard-card'
import { BenchmarkSelector } from './_components/server/benchmark-selector'
import { LeaderboardCardSkeleton } from './_components/skeletons'

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
            {/* Page Header */}
            <div>
                <h1 className="mb-2 text-3xl font-bold">Leaderboard</h1>
                <p className="text-muted-foreground">Compare model performance across benchmarks</p>
            </div>

            {/* Benchmark Selector */}
            <Suspense fallback={<Skeleton className="h-10 w-[400px]" />}>
                <BenchmarkSelectorWrapper searchParams={searchParams} />
            </Suspense>

            {/* Selected Benchmark Display */}
            <Suspense fallback={<LeaderboardCardSkeleton />}>
                <SelectedBenchmarkDisplay searchParams={searchParams} />
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
 * Wrapper to await searchParams and pass to BenchmarkSelector.
 */
async function BenchmarkSelectorWrapper({ searchParams }: { searchParams: Promise<{ benchmarkId?: string }> }) {
    const benchmarkId = await getEffectiveBenchmarkId(searchParams)
    return <BenchmarkSelector selectedId={benchmarkId} />
}

/**
 * Server component that fetches and displays the selected benchmark's leaderboard.
 */
async function SelectedBenchmarkDisplay({ searchParams }: { searchParams: Promise<{ benchmarkId?: string }> }) {
    const benchmarkId = await getEffectiveBenchmarkId(searchParams)

    // Handle no benchmarks available
    if (!benchmarkId) {
        return (
            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
                <p>No leaderboard data available.</p>
                <p className="mt-2 text-sm">Load model predictions and statistics to see comparisons.</p>
            </div>
        )
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

    // Get benchmark details from first entry (all entries share same benchmark)
    const benchmarkName = entries[0].benchmarkName

    // Check if benchmark has ground truth (based on presence of topKAccuracy)
    const hasGroundTruth = entries.some((entry) => entry.metrics.topKAccuracy !== undefined)

    return (
        <BenchmarkLeaderboardCard
            benchmarkId={benchmarkId}
            benchmarkName={benchmarkName}
            hasGroundTruth={hasGroundTruth}
            entries={entries}
        />
    )
}
