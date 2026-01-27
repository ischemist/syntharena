import { Suspense } from 'react'
import type { Metadata } from 'next'

import * as predictionView from '@/lib/services/view/prediction.view'

import { StockSelector } from './_components/client/stock-selector'
import { RunStatisticsStratified } from './_components/server/run-statistics-stratified'
import { RunStatisticsSummary } from './_components/server/run-statistics-summary'
import { RunTitleCard } from './_components/server/run-title-card'
import { TargetDisplaySection } from './_components/server/target-display-section'
import { TargetSearchWrapper } from './_components/server/target-search-wrapper'
import { RouteDisplaySkeleton, RunStatisticsSkeleton, StratifiedStatisticsSkeleton } from './_components/skeletons'

type PageProps = {
    // These are now promises
    params: Promise<{ runId: string }>
    searchParams: Promise<{
        stock?: string
        target?: string
        rank?: string
        layout?: string
        routeLength?: string
        acceptableIndex?: string
        onlyWithPredictions?: string
    }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { runId } = await params
    try {
        const run = await predictionView.getRunTitleCardData(runId)
        return {
            title: `${run.modelFamilyName} on ${run.benchmarkName}`,
            description: `View statistics and routes for ${run.modelFamilyName} predictions on ${run.benchmarkName}.`,
        }
    } catch {
        return {
            title: 'Run Not Found',
            description: 'The requested prediction run could not be found.',
        }
    }
}

export default async function RunDetailPage({ params, searchParams }: PageProps) {
    // --- Await promises at the top level ---
    const { runId } = await params
    const searchParamsValues = await searchParams

    // --- Data Orchestration ---
    const defaults = await predictionView.getRunDefaults(runId, searchParamsValues.stock, searchParamsValues.target)
    const stockId = searchParamsValues.stock ?? defaults.stockId
    const targetId = searchParamsValues.target ?? defaults.targetId
    const rank = parseInt(searchParamsValues.rank || '1', 10)
    const layout = searchParamsValues.layout
    const routeLength = searchParamsValues.routeLength
    const acceptableIndex = searchParamsValues.acceptableIndex
        ? parseInt(searchParamsValues.acceptableIndex, 10)
        : undefined
    const onlyWithPredictions = searchParamsValues.onlyWithPredictions === 'true'

    // Initiate all data fetches concurrently. Do NOT await them here.
    const titleCardPromise = predictionView.getRunTitleCardData(runId)
    const stocksPromise = predictionView.getStocksForRun(runId)
    const statsPromise = stockId ? predictionView.getRunStatistics(runId, stockId) : Promise.resolve(null)
    const targetDisplayDataPromise = targetId
        ? predictionView.getTargetDisplayData(runId, targetId, rank, stockId, acceptableIndex, layout)
        : null

    return (
        <div className="flex flex-col gap-6">
            <Suspense fallback={<div className="bg-card h-48 animate-pulse rounded-lg" />}>
                <RunTitleCard dataPromise={titleCardPromise} />
            </Suspense>

            <Suspense fallback={<div className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />}>
                <StockSelectorWrapper stocksPromise={stocksPromise} currentStockId={stockId} />
            </Suspense>

            <Suspense fallback={<RunStatisticsSkeleton />}>
                <RunStatisticsSummary dataPromise={statsPromise} stockId={stockId} />
            </Suspense>

            <Suspense fallback={<StratifiedStatisticsSkeleton />}>
                <RunStatisticsStratified dataPromise={statsPromise} stockId={stockId} />
            </Suspense>

            <TargetSearchWrapper
                runId={runId}
                stockId={stockId}
                currentTargetId={targetId}
                routeLength={routeLength}
                onlyWithPredictions={onlyWithPredictions}
            />
            {targetDisplayDataPromise && (
                <Suspense
                    key={`${targetId}-${rank}-${stockId}-${layout}-${acceptableIndex}`}
                    fallback={<RouteDisplaySkeleton />}
                >
                    <ResolvedTargetDisplay dataPromise={targetDisplayDataPromise} />
                </Suspense>
            )}
        </div>
    )
}

/** Async component to resolve the mega-DTO promise inside the Suspense boundary. */
async function ResolvedTargetDisplay({
    dataPromise,
}: {
    dataPromise: Promise<Awaited<ReturnType<typeof predictionView.getTargetDisplayData>>>
}) {
    const data = await dataPromise
    return <TargetDisplaySection data={data} />
}
// Wrapper to handle promise for StockSelector
async function StockSelectorWrapper({
    stocksPromise,
    currentStockId,
}: {
    stocksPromise: Promise<Awaited<ReturnType<typeof predictionView.getStocksForRun>>>
    currentStockId?: string
}) {
    const stocks = await stocksPromise
    if (stocks.length <= 1) return null
    // Pass the resolved currentStockId, not the searchParams object
    return <StockSelector stocks={stocks} currentStockId={currentStockId} />
}
