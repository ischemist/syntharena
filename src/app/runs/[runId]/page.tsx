import { Suspense } from 'react'
import { notFound } from 'next/navigation'

import { getPredictionRunById } from '@/lib/services/prediction.service'
import { getStocks } from '@/lib/services/stock.service'

import { StockSelector } from './_components/client/stock-selector'
import { RunDetailHeader } from './_components/server/run-detail-header'
import { RunStatisticsSummary } from './_components/server/run-statistics-summary'
import { TargetFilterBar } from './_components/server/target-filter-bar'
import { TargetGrid } from './_components/server/target-grid'
import { RunStatisticsSkeleton, TargetGridSkeleton } from './_components/skeletons'

type PageProps = {
    params: Promise<{ runId: string }>
    searchParams: Promise<{
        stock?: string
        gtStatus?: string
        length?: string
        solvable?: string
        page?: string
    }>
}

export default async function RunDetailPage({ params, searchParams }: PageProps) {
    const { runId } = await params
    const [run, stocks] = await Promise.all([getPredictionRunById(runId), getStocks()])

    if (!run) {
        notFound()
    }

    return (
        <div className="flex flex-col gap-6">
            <RunDetailHeader run={run} />

            <StockSelector stocks={stocks} />

            <Suspense fallback={<RunStatisticsSkeleton />}>
                <RunStatisticsSummary runId={runId} searchParams={searchParams} />
            </Suspense>

            <TargetFilterBar benchmarkSet={run.benchmarkSet} />

            <Suspense fallback={<TargetGridSkeleton />}>
                <TargetGrid runId={runId} searchParams={searchParams} />
            </Suspense>
        </div>
    )
}
