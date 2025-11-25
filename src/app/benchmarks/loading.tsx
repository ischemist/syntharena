import { BenchmarkListSkeleton } from './_components/skeletons'

/**
 * Loading shell for benchmarks list page.
 * Provides instant full-page layout before data loads.
 * Uses static skeleton to prevent layout shift.
 */
export default function BenchmarksLoading() {
    return (
        <div className="space-y-6">
            {/* Header section with static content */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Benchmark Sets</h1>
                <p className="text-muted-foreground">
                    Browse retrosynthesis benchmark datasets with ground truth routes
                </p>
            </div>

            {/* Skeleton for benchmark cards */}
            <BenchmarkListSkeleton />
        </div>
    )
}
