import { BenchmarkDetailHeaderSkeleton, TargetGridSkeleton } from '../_components/skeletons'

/**
 * Loading shell for benchmark detail page.
 * Provides instant full-page layout before data loads.
 * Uses static skeleton to prevent layout shift.
 */
export default function BenchmarkDetailLoading() {
    return (
        <div className="space-y-6">
            <BenchmarkDetailHeaderSkeleton />
            <TargetGridSkeleton />
        </div>
    )
}
