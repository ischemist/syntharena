import { Suspense } from 'react'
import { notFound } from 'next/navigation'

import { getPredictionRunById } from '@/lib/services/prediction.service'
import { getStocks } from '@/lib/services/stock.service'

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
    }>
}

export default async function RunDetailPage({ params, searchParams }: PageProps) {
    const { runId } = await params
    const searchParamsResolved = await searchParams
    const [run, stocks] = await Promise.all([getPredictionRunById(runId), getStocks()])

    if (!run) {
        notFound()
    }

    const stockId = searchParamsResolved.stock
    const targetId = searchParamsResolved.target
    const rank = parseInt(searchParamsResolved.rank || '1', 10)

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
            <TargetSearchWrapper runId={runId} stockId={stockId} />

            {/* Conditional route display */}
            {targetId && (
                <Suspense key={`${targetId}-${rank}`} fallback={<RouteDisplaySkeleton />}>
                    <TargetRouteDisplay runId={runId} targetId={targetId} rank={rank} stockId={stockId} />
                </Suspense>
            )}
        </div>
    )
}
