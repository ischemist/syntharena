import { Suspense } from 'react'
import type { Metadata } from 'next'

import { getPredictionRunById } from '@/lib/services/prediction.service'

import { RunDetailHeaderWrapper, StockSelectorWrapper, TargetSearchSectionWrapper } from './_components/server/wrappers'
import { RouteDisplaySkeleton, RunStatisticsSkeleton, StratifiedStatisticsSkeleton } from './_components/skeletons'

type PageProps = {
    params: Promise<{ runId: string }>
    searchParams: Promise<{
        stock?: string
        search?: string
        target?: string
        rank?: string
        view?: string
    }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { runId } = await params

    try {
        const run = await getPredictionRunById(runId)
        const modelName = run.modelInstance.name || run.modelInstance.algorithm.name
        const benchmarkName = run.benchmarkSet.name

        return {
            title: `${modelName} on ${benchmarkName}`,
            description: `View statistics and routes for ${modelName} predictions on ${benchmarkName}.`,
        }
    } catch {
        return {
            title: 'Run Not Found',
            description: 'The requested prediction run could not be found.',
        }
    }
}

export default function RunDetailPage({ params, searchParams }: PageProps) {
    return (
        <div className="flex flex-col gap-6">
            {/* Header - fast render */}
            <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />}>
                <RunDetailHeaderWrapper params={params} />
            </Suspense>

            {/* Stock Selector - fast render */}
            <Suspense fallback={<div className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />}>
                <StockSelectorWrapper params={params} searchParams={searchParams} />
            </Suspense>

            {/* Statistics - stream independently */}
            <Suspense fallback={<RunStatisticsSkeleton />}>
                <RunStatisticsSummaryWrapper params={params} searchParams={searchParams} />
            </Suspense>

            <Suspense fallback={<StratifiedStatisticsSkeleton />}>
                <RunStatisticsStratifiedWrapper params={params} searchParams={searchParams} />
            </Suspense>

            {/* Target search and route display - stream independently */}
            <Suspense fallback={<RouteDisplaySkeleton />}>
                <TargetSearchSectionWrapper params={params} searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

// ============================================================================
// Wrapper Components - Self-Fetch Their Data
// ============================================================================

async function RunStatisticsSummaryWrapper({
    params,
    searchParams,
}: {
    params: Promise<{ runId: string }>
    searchParams: Promise<{ stock?: string }>
}) {
    const { runId } = await params
    const { RunStatisticsSummary } = await import('./_components/server/run-statistics-summary')
    return <RunStatisticsSummary runId={runId} searchParams={searchParams} />
}

async function RunStatisticsStratifiedWrapper({
    params,
    searchParams,
}: {
    params: Promise<{ runId: string }>
    searchParams: Promise<{ stock?: string }>
}) {
    const { runId } = await params
    const { RunStatisticsStratified } = await import('./_components/server/run-statistics-stratified')
    return <RunStatisticsStratified runId={runId} searchParams={searchParams} />
}
