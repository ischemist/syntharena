import { Suspense, use } from 'react'
import type { Metadata } from 'next'

import { getBenchmarkById } from '@/lib/services/view/benchmark.view'

import { BenchmarkDetailHeader } from './_components/server/benchmark-detail-header'
import { TargetFilterBar } from './_components/server/target-filter-bar'
import { TargetGrid } from './_components/server/target-grid'
import { BenchmarkDetailHeaderSkeleton, TargetFilterBarSkeleton, TargetGridSkeleton } from './_components/skeletons'

interface BenchmarkDetailPageProps {
    params: Promise<{ benchmarkId: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: BenchmarkDetailPageProps): Promise<Metadata> {
    const { benchmarkId } = await params
    const benchmark = await getBenchmarkById(benchmarkId)

    return {
        title: benchmark?.name || 'Benchmark',
        description: benchmark?.description || 'View benchmark targets and ground truth routes.',
    }
}

/**
 * Benchmark detail page showing benchmark information, search/filter controls, and target molecule grid.
 * Remains synchronous per the app router manifesto, unwrapping promises with use().
 * Delegates data fetching to async server components wrapped in Suspense boundaries.
 * Header, filter bar, and target grid load independently via streaming.
 */
export default function BenchmarkDetailPage(props: BenchmarkDetailPageProps) {
    // ORTHODOXY: Unwrap promises in sync component (Next.js 15 pattern)
    const params = use(props.params)
    const searchParams = use(props.searchParams)

    const { benchmarkId } = params

    // Parse pagination
    const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1

    // Parse search parameters
    const q = typeof searchParams.q === 'string' ? searchParams.q : undefined
    const searchType =
        typeof searchParams.searchType === 'string'
            ? (searchParams.searchType as 'smiles' | 'inchikey' | 'targetId' | 'all')
            : 'all'

    // Parse filter parameters
    const convergentParam = typeof searchParams.convergent === 'string' ? searchParams.convergent : undefined
    const isConvergent = convergentParam === 'true' ? true : convergentParam === 'false' ? false : undefined

    const minLengthParam = typeof searchParams.minLength === 'string' ? parseInt(searchParams.minLength, 10) : undefined
    const minRouteLength = isNaN(minLengthParam ?? NaN) ? undefined : minLengthParam

    const maxLengthParam = typeof searchParams.maxLength === 'string' ? parseInt(searchParams.maxLength, 10) : undefined
    const maxRouteLength = isNaN(maxLengthParam ?? NaN) ? undefined : maxLengthParam

    // Create a key that includes all search/filter params for proper Suspense boundaries
    const gridKey = `grid-${page}-${q || ''}-${searchType}-${isConvergent}-${minRouteLength}-${maxRouteLength}`

    return (
        <div className="flex flex-col gap-6">
            {/* Benchmark header with lazy loading */}
            <Suspense fallback={<BenchmarkDetailHeaderSkeleton />}>
                <BenchmarkDetailHeader benchmarkId={benchmarkId} />
            </Suspense>

            {/* Search and filter bar with lazy loading */}
            <Suspense fallback={<TargetFilterBarSkeleton />}>
                <TargetFilterBar benchmarkId={benchmarkId} />
            </Suspense>

            {/* Target grid with pagination */}
            <Suspense key={gridKey} fallback={<TargetGridSkeleton />}>
                <TargetGrid
                    benchmarkId={benchmarkId}
                    page={page}
                    limit={25}
                    searchQuery={q}
                    searchType={searchType}
                    isConvergent={isConvergent}
                    minRouteLength={minRouteLength}
                    maxRouteLength={maxRouteLength}
                />
            </Suspense>
        </div>
    )
}
