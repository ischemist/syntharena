import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound, permanentRedirect, unstable_rethrow } from 'next/navigation'

import * as benchmarkData from '@/lib/services/data/benchmark.data'
import * as benchmarkView from '@/lib/services/view/benchmark.view'
import { getBenchmarkById } from '@/lib/services/view/benchmark.view'
import { buildSearchParams, resolveBenchmarkUrlKey, withSearchParams } from '@/lib/routing/url-resolver'

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
        const destination = await resolveBenchmarkUrlKey(benchmarkId)
        if (!destination) return { title: 'Benchmark Not Found' }
        const benchmark = await getBenchmarkById(destination.id)
        return {
            title: benchmark.name,
            description: benchmark.description || 'View benchmark targets and ground truth routes.',
            alternates: { canonical: `/benchmarks/${destination.slug}` },
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
    return (
        <Suspense fallback={<BenchmarkDetailPageFallback />}>
            <ResolvedBenchmarkDetailPage paramsPromise={params} searchParamsPromise={searchParams} />
        </Suspense>
    )
}

function BenchmarkDetailPageFallback() {
    return (
        <div className="flex flex-col gap-6">
            <BenchmarkDetailHeaderSkeleton />
            <TargetGridSkeleton />
        </div>
    )
}

async function ResolvedBenchmarkDetailPage({
    paramsPromise,
    searchParamsPromise,
}: {
    paramsPromise: BenchmarkDetailPageProps['params']
    searchParamsPromise: BenchmarkDetailPageProps['searchParams']
}) {
    const [{ benchmarkId }, searchParamsValues] = await Promise.all([paramsPromise, searchParamsPromise])
    const destination = await resolveBenchmarkUrlKey(benchmarkId)
    if (!destination) notFound()
    if (benchmarkId !== destination.slug) {
        permanentRedirect(withSearchParams(`/benchmarks/${destination.slug}`, buildSearchParams(searchParamsValues)))
    }

    const benchmarkIdPromise = Promise.resolve(destination.id)
    return (
        <div className="flex flex-col gap-6">
            <Suspense fallback={<BenchmarkDetailHeaderSkeleton />}>
                <ResolvedHeaderAndFilters benchmarkIdPromise={benchmarkIdPromise} />
            </Suspense>
            <Suspense fallback={<TargetGridSkeleton />}>
                <ResolvedTargetGrid
                    benchmarkIdPromise={benchmarkIdPromise}
                    benchmarkSlug={destination.slug}
                    searchParamsValues={searchParamsValues}
                />
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
    benchmarkSlug,
    searchParamsValues,
}: {
    benchmarkIdPromise: Promise<string>
    benchmarkSlug: string
    searchParamsValues: Awaited<BenchmarkDetailPageProps['searchParams']>
}) {
    const benchmarkId = await benchmarkIdPromise
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

    const targetsResult = await benchmarkView
        .getBenchmarkTargets(
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
        .catch((error) => {
            unstable_rethrow(error)
            throw error
        })

    if (!targetsResult) {
        notFound()
    }

    return <TargetGrid benchmarkSlug={benchmarkSlug} result={targetsResult} />
}
