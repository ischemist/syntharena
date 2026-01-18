import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import * as benchmarkData from '@/lib/services/data/benchmark.data'
import * as benchmarkView from '@/lib/services/view/benchmark.view'
import { getBenchmarkById } from '@/lib/services/view/benchmark.view'

import { BenchmarkDetailHeader } from './_components/server/benchmark-detail-header'
import { TargetFilterBar } from './_components/server/target-filter-bar'
import { TargetGrid } from './_components/server/target-grid'
import { BenchmarkDetailHeaderSkeleton, TargetGridSkeleton } from './_components/skeletons'

interface BenchmarkDetailPageProps {
    params: Promise<{ benchmarkId: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: BenchmarkDetailPageProps): Promise<Metadata> {
    const { benchmarkId } = await params
    try {
        const benchmark = await getBenchmarkById(benchmarkId)
        return {
            title: benchmark.name,
            description: benchmark.description || 'View benchmark targets and ground truth routes.',
        }
    } catch {
        return { title: 'Benchmark Not Found' }
    }
}

/**
 * Benchmark detail page showing benchmark information, search/filter controls, and target molecule grid.
 * Fetches ALL page data upfront via a single, parallelized call to the view model.
 * The page-level `loading.tsx` handles the initial loading state.
 */
export default function BenchmarkDetailPage({ params, searchParams }: BenchmarkDetailPageProps) {
    const benchmarkIdPromise = params.then((p) => p.benchmarkId)

    return (
        <div className="flex flex-col gap-6">
            <Suspense fallback={<BenchmarkDetailHeaderSkeleton />}>
                <ResolvedHeaderAndFilters benchmarkIdPromise={benchmarkIdPromise} />
            </Suspense>

            <Suspense fallback={<TargetGridSkeleton />}>
                <ResolvedTargetGrid benchmarkIdPromise={benchmarkIdPromise} searchParamsPromise={searchParams} />
            </Suspense>
        </div>
    )
}

async function ResolvedHeaderAndFilters({ benchmarkIdPromise }: { benchmarkIdPromise: Promise<string> }) {
    const benchmarkId = await benchmarkIdPromise
    // Fetch only the data needed for the header and filters
    const [benchmark, stats] = await Promise.all([
        benchmarkView.getBenchmarkById(benchmarkId),
        benchmarkData.computeBenchmarkStats(benchmarkId),
    ])

    return (
        <>
            <BenchmarkDetailHeader benchmark={benchmark} />
            <TargetFilterBar stats={stats} />
        </>
    )
}
async function ResolvedTargetGrid({
    benchmarkIdPromise,
    searchParamsPromise,
}: {
    benchmarkIdPromise: Promise<string>
    searchParamsPromise: BenchmarkDetailPageProps['searchParams']
}) {
    const [benchmarkId, searchParamsValues] = await Promise.all([benchmarkIdPromise, searchParamsPromise])
    try {
        const page = typeof searchParamsValues.page === 'string' ? parseInt(searchParamsValues.page, 10) : 1
        const q = typeof searchParamsValues.q === 'string' ? searchParamsValues.q : undefined
        const searchType =
            typeof searchParamsValues.searchType === 'string'
                ? (searchParamsValues.searchType as 'smiles' | 'inchikey' | 'targetId' | 'all')
                : 'all'
        const convergentParam =
            typeof searchParamsValues.convergent === 'string' ? searchParamsValues.convergent : undefined
        const isConvergent = convergentParam === 'true' ? true : convergentParam === 'false' ? false : undefined
        const minLengthParam =
            typeof searchParamsValues.minLength === 'string' ? parseInt(searchParamsValues.minLength, 10) : undefined
        const minRouteLength = isNaN(minLengthParam ?? NaN) ? undefined : minLengthParam
        const maxLengthParam =
            typeof searchParamsValues.maxLength === 'string' ? parseInt(searchParamsValues.maxLength, 10) : undefined
        const maxRouteLength = isNaN(maxLengthParam ?? NaN) ? undefined : maxLengthParam

        const targetsResult = await benchmarkView.getBenchmarkTargets(
            benchmarkId,
            page,
            25,
            q,
            searchType,
            undefined, // hasGroundTruth - not used here
            minRouteLength,
            maxRouteLength,
            isConvergent
        )
        return <TargetGrid benchmarkId={benchmarkId} result={targetsResult} />
    } catch {
        notFound()
    }
}
