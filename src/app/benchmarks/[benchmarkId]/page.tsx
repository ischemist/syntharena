import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import * as benchmarkView from '@/lib/services/view/benchmark.view'
import { getBenchmarkById } from '@/lib/services/view/benchmark.view'

import { BenchmarkDetailHeader } from './_components/server/benchmark-detail-header'
import { TargetFilterBar } from './_components/server/target-filter-bar'
import { TargetGrid } from './_components/server/target-grid'

interface BenchmarkDetailPageProps {
    params: { benchmarkId: string }
    searchParams: { [key: string]: string | string[] | undefined }
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
export default async function BenchmarkDetailPage({ params, searchParams }: BenchmarkDetailPageProps) {
    const { benchmarkId } = await params
    const searchParamsValues = await searchParams

    // Parse pagination
    const page = typeof searchParamsValues.page === 'string' ? parseInt(searchParamsValues.page, 10) : 1

    // Parse search parameters
    const q = typeof searchParamsValues.q === 'string' ? searchParamsValues.q : undefined
    const searchType =
        typeof searchParamsValues.searchType === 'string'
            ? (searchParamsValues.searchType as 'smiles' | 'inchikey' | 'targetId' | 'all')
            : 'all'

    // Parse filter parameters
    const convergentParam =
        typeof searchParamsValues.convergent === 'string' ? searchParamsValues.convergent : undefined
    const isConvergent = convergentParam === 'true' ? true : convergentParam === 'false' ? false : undefined

    const minLengthParam =
        typeof searchParamsValues.minLength === 'string' ? parseInt(searchParamsValues.minLength, 10) : undefined
    const minRouteLength = isNaN(minLengthParam ?? NaN) ? undefined : minLengthParam

    const maxLengthParam =
        typeof searchParamsValues.maxLength === 'string' ? parseInt(searchParamsValues.maxLength, 10) : undefined
    const maxRouteLength = isNaN(maxLengthParam ?? NaN) ? undefined : maxLengthParam

    // --- Single, parallel data fetch for the entire page ---
    let pageData
    try {
        pageData = await benchmarkView.getBenchmarkDetailPageData(
            benchmarkId,
            page,
            25, // limit
            q,
            searchType,
            minRouteLength,
            maxRouteLength,
            isConvergent
        )
    } catch (error) {
        notFound()
    }

    const { benchmark, stats, targetsResult } = pageData

    return (
        <div className="flex flex-col gap-6">
            <BenchmarkDetailHeader benchmark={benchmark} />
            <TargetFilterBar stats={stats} />
            <TargetGrid benchmarkId={benchmarkId} result={targetsResult} />
        </div>
    )
}
