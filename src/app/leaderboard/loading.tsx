import { LeaderboardFiltersSkeleton, LeaderboardTableSkeleton } from './_components/skeletons'

/**
 * Loading state for leaderboard page.
 * Shows instant skeleton while server components fetch data.
 */
export default function LeaderboardLoading() {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="mb-2 text-3xl font-bold">Leaderboard</h1>
                <p className="text-muted-foreground">Compare model performance across benchmarks</p>
            </div>

            <LeaderboardFiltersSkeleton />
            <LeaderboardTableSkeleton />
        </div>
    )
}
