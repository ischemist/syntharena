// src/app/runs/[runId]/page.tsx
import { Suspense } from 'react'
import type { Metadata } from 'next'

import * as predictionView from '@/lib/services/view/prediction.view'

import { StockSelector } from './_components/client/stock-selector'
import { RunDetailHeader } from './_components/server/run-detail-header'
import { RunStatisticsStratified } from './_components/server/run-statistics-stratified'
import { RunStatisticsSummary } from './_components/server/run-statistics-summary'
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
        view?: string
        routeLength?: string
        acceptableIndex?: string
    }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { runId } = await params // <-- FIX: await the params promise
    try {
        const run = await predictionView.getPredictionRunHeader(runId)
        return {
            title: `${run.modelName} on ${run.benchmarkName}`,
            description: `View statistics and routes for ${run.modelName} predictions on ${run.benchmarkName}.`,
        }
    } catch {
        return { title: 'Run Not Found', description: 'The requested prediction run could not be found.' }
    }
}

export default async function RunDetailPage({ params, searchParams }: PageProps) {
    // --- FIX: Await promises at the top level ---
    const { runId } = await params
    const searchParamsValues = await searchParams

    // --- Data Orchestration ---
    const defaults = await predictionView.getRunDefaults(runId, searchParamsValues.stock, searchParamsValues.target)
    const stockId = searchParamsValues.stock ?? defaults.stockId
    const targetId = searchParamsValues.target ?? defaults.targetId
    const rank = parseInt(searchParamsValues.rank || '1', 10)
    const viewMode = searchParamsValues.view
    const routeLength = searchParamsValues.routeLength
    const acceptableIndex = searchParamsValues.acceptableIndex
        ? parseInt(searchParamsValues.acceptableIndex, 10)
        : undefined

    // Initiate all data fetches concurrently. Do NOT await them here.
    const headerPromise = predictionView.getPredictionRunHeader(runId)
    const stocksPromise = predictionView.getStocksForRun(runId)
    const statsPromise = stockId ? predictionView.getRunStatistics(runId, stockId) : Promise.resolve(null)
    const targetDetailPromise =
        targetId && stockId ? predictionView.getTargetPredictions(targetId, runId, stockId) : Promise.resolve(null)

    return (
        <div className="flex flex-col gap-6">
            <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />}>
                <RunDetailHeader dataPromise={headerPromise} />
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

            <TargetSearchWrapper runId={runId} stockId={stockId} currentTargetId={targetId} routeLength={routeLength} />

            {targetId && (
                <Suspense
                    key={`${targetId}-${rank}-${viewMode}-${acceptableIndex}`} // Key ensures suspense resets on navigation
                    fallback={<RouteDisplaySkeleton />}
                >
                    <TargetDisplaySection
                        targetDetailPromise={targetDetailPromise}
                        runId={runId}
                        rank={rank}
                        stockId={stockId}
                        viewMode={viewMode}
                        acceptableIndex={acceptableIndex}
                    />
                </Suspense>
            )}
        </div>
    )
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
