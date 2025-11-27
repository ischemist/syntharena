import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { getPredictionRunById, getStocksForRun, getTargetIdsByRun } from '@/lib/services/prediction.service'

import { StockSelector } from './_components/client/stock-selector'
import { RunDetailHeader } from './_components/server/run-detail-header'
import { RunStatisticsStratified } from './_components/server/run-statistics-stratified'
import { RunStatisticsSummary } from './_components/server/run-statistics-summary'
import { TargetRouteDisplay } from './_components/server/target-route-display'
import { TargetSearchWrapper } from './_components/server/target-search-wrapper'
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

export default async function RunDetailPage({ params, searchParams }: PageProps) {
    const { runId } = await params
    const searchParamsResolved = await searchParams
    const [run, stocks, targetIds] = await Promise.all([
        getPredictionRunById(runId),
        getStocksForRun(runId),
        getTargetIdsByRun(runId),
    ])

    if (!run) {
        notFound()
    }

    // If no stock is selected and we have stocks, redirect to first stock
    if (!searchParamsResolved.stock && stocks.length > 0) {
        const params = new URLSearchParams(searchParamsResolved as Record<string, string>)
        params.set('stock', stocks[0].id)
        redirect(`?${params.toString()}`)
    }

    // If no target is selected and we have targets, redirect to first target
    if (!searchParamsResolved.target && targetIds.length > 0) {
        const params = new URLSearchParams(searchParamsResolved as Record<string, string>)
        params.set('target', targetIds[0])
        params.set('rank', '1')
        redirect(`?${params.toString()}`)
    }

    const stockId = searchParamsResolved.stock
    const targetId = searchParamsResolved.target
    const rank = parseInt(searchParamsResolved.rank || '1', 10)
    const viewMode = searchParamsResolved.view

    return (
        <div className="flex flex-col gap-6">
            <RunDetailHeader run={run} />

            <StockSelector stocks={stocks} />

            <Suspense fallback={<RunStatisticsSkeleton />}>
                <RunStatisticsSummary runId={runId} searchParams={Promise.resolve(searchParamsResolved)} />
            </Suspense>

            <Suspense fallback={<StratifiedStatisticsSkeleton />}>
                <RunStatisticsStratified runId={runId} searchParams={Promise.resolve(searchParamsResolved)} />
            </Suspense>

            {/* Target search */}
            <TargetSearchWrapper runId={runId} stockId={stockId} currentTargetId={targetId} />

            {/* Conditional route display */}
            {targetId && (
                <Suspense key={`${targetId}-${rank}-${viewMode}`} fallback={<RouteDisplaySkeleton />}>
                    <TargetRouteDisplay
                        runId={runId}
                        targetId={targetId}
                        rank={rank}
                        stockId={stockId}
                        viewMode={viewMode}
                    />
                </Suspense>
            )}
        </div>
    )
}
