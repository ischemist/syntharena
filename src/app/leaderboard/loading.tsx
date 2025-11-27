import { LeaderboardCardSkeleton } from './_components/skeletons'

/**
 * Instant loading state for leaderboard page.
 * Shows skeleton while data is being fetched.
 */
export default function Loading() {
    return (
        <div className="flex flex-col gap-6">
            {/* Page Header */}
            <div>
                <div className="bg-muted mb-2 h-9 w-48 animate-pulse rounded" />
                <div className="bg-muted h-5 w-80 animate-pulse rounded" />
            </div>

            {/* Stock Filter Skeleton */}
            <div className="bg-muted h-16 w-full animate-pulse rounded-lg" />

            {/* Benchmark Cards Skeletons */}
            <div className="space-y-8">
                <LeaderboardCardSkeleton />
                <LeaderboardCardSkeleton />
            </div>
        </div>
    )
}
