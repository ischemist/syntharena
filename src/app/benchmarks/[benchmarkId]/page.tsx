import { Suspense, use } from 'react'

import { BenchmarkDetailHeaderSkeleton, TargetGridSkeleton } from '../_components/skeletons'
import { BenchmarkDetailHeader } from './_components/server/benchmark-detail-header'
import { TargetGrid } from './_components/server/target-grid'

interface BenchmarkDetailPageProps {
    params: Promise<{ benchmarkId: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * Benchmark detail page showing benchmark information and target molecule grid.
 * Remains synchronous per the app router manifesto, unwrapping promises with use().
 * Delegates data fetching to async server components wrapped in Suspense boundaries.
 * Header and target grid load independently via streaming.
 */
export default function BenchmarkDetailPage(props: BenchmarkDetailPageProps) {
    // ORTHODOXY: Unwrap promises in sync component (Next.js 15 pattern)
    const params = use(props.params)
    const searchParams = use(props.searchParams)

    const { benchmarkId } = params
    const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1

    return (
        <div className="space-y-6">
            {/* Benchmark header with lazy loading */}
            <Suspense fallback={<BenchmarkDetailHeaderSkeleton />}>
                <BenchmarkDetailHeader benchmarkId={benchmarkId} />
            </Suspense>

            {/* Target grid with pagination */}
            <Suspense key={`page-${page}`} fallback={<TargetGridSkeleton />}>
                <TargetGrid benchmarkId={benchmarkId} page={page} limit={24} />
            </Suspense>
        </div>
    )
}
