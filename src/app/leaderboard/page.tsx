import { Suspense } from 'react'

import { getLeaderboardByBenchmark } from '@/lib/services/leaderboard.service'

import { BenchmarkLeaderboardCard } from './_components/server/benchmark-leaderboard-card'
import { LeaderboardCardSkeleton } from './_components/skeletons'

/**
 * Leaderboard page for comparing model performance across benchmarks.
 * Shows one card per benchmark with integrated table/chart toggle.
 *
 * Following App Router Manifesto:
 * - Page is NOT async - defines structure and Suspense boundaries only
 * - All data fetching pushed to child server components
 * - Each benchmark card wrapped in Suspense for independent streaming
 */
export default function LeaderboardPage() {
    return (
        <div className="flex flex-col gap-6">
            {/* Page Header */}
            <div>
                <h1 className="mb-2 text-3xl font-bold">Leaderboard</h1>
                <p className="text-muted-foreground">Compare model performance across benchmarks</p>
            </div>

            {/* Benchmark Cards */}
            <Suspense fallback={<LeaderboardCardSkeleton />}>
                <BenchmarkCards />
            </Suspense>
        </div>
    )
}

/**
 * Server component that fetches leaderboard data and renders benchmark cards.
 */
async function BenchmarkCards() {
    // Get leaderboard data grouped by benchmark (all stocks)
    const benchmarkGroups = await getLeaderboardByBenchmark()

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
        <div className="space-y-6">
            {Array.from(benchmarkGroups.values()).map((group) => (
                <BenchmarkLeaderboardCard
                    key={group.benchmarkId}
                    benchmarkId={group.benchmarkId}
                    benchmarkName={group.benchmarkName}
                    hasGroundTruth={group.hasGroundTruth}
                    entries={group.entries}
                />
            ))}
        </div>
    )
}
