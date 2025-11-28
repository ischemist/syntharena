import { Suspense } from 'react'
import { notFound } from 'next/navigation'

import { getPredictionRunById, getStocksForRun, getTargetIdsByRun } from '@/lib/services/prediction.service'

import { StockSelector } from '../client/stock-selector'
import { RouteDisplaySkeleton } from '../skeletons'
import { RunDetailHeader } from './run-detail-header'
import { TargetInfoDisplay } from './target-info-display'
import { TargetRouteGraphDisplay } from './target-route-graph-display'
import { TargetSearchWrapper } from './target-search-wrapper'

// ============================================================================
// Self-Fetching Wrapper Components (Phase 7)
// ============================================================================

type ParamsProps = {
    params: Promise<{ runId: string }>
}

type SearchParamsProps = {
    searchParams: Promise<{
        stock?: string
        search?: string
        target?: string
        rank?: string
        view?: string
    }>
}

/**
 * Wrapper for RunDetailHeader - fetches run data independently
 */
export async function RunDetailHeaderWrapper({ params }: ParamsProps) {
    const { runId } = await params
    const run = await getPredictionRunById(runId)

    if (!run) {
        notFound()
    }

    return <RunDetailHeader run={run} />
}

/**
 * Wrapper for StockSelector - fetches stocks and passes to client for default selection
 */
export async function StockSelectorWrapper({ params, searchParams }: ParamsProps & SearchParamsProps) {
    const { runId } = await params
    const searchParamsResolved = await searchParams

    const [stocks, targetIds] = await Promise.all([getStocksForRun(runId), getTargetIdsByRun(runId)])

    // Pass data to client component for client-side default selection (Phase 5)
    return (
        <StockSelector
            stocks={stocks}
            hasStock={!!searchParamsResolved.stock}
            hasTarget={!!searchParamsResolved.target}
            firstTargetId={targetIds[0]}
        />
    )
}

/**
 * Wrapper for target search and route display section - handles all target-related UI
 */
export async function TargetSearchSectionWrapper({ params, searchParams }: ParamsProps & SearchParamsProps) {
    const { runId } = await params
    const searchParamsResolved = await searchParams

    const stockId = searchParamsResolved.stock
    const targetId = searchParamsResolved.target
    const rank = parseInt(searchParamsResolved.rank || '1', 10)
    const viewMode = searchParamsResolved.view

    return (
        <>
            {/* Target search */}
            <TargetSearchWrapper runId={runId} stockId={stockId} currentTargetId={targetId} />

            {/* Conditional route display - split into fast and slow paths */}
            {targetId && (
                <>
                    {/* Fast path: Show target metadata immediately */}
                    <Suspense
                        key={`info-${targetId}`}
                        fallback={<div className="h-32 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />}
                    >
                        <TargetInfoDisplay runId={runId} targetId={targetId} stockId={stockId} />
                    </Suspense>

                    {/* Slow path: Stream route graph as it loads */}
                    <Suspense key={`${targetId}-${rank}-${viewMode}`} fallback={<RouteDisplaySkeleton />}>
                        <TargetRouteGraphDisplay
                            runId={runId}
                            targetId={targetId}
                            rank={rank}
                            stockId={stockId}
                            viewMode={viewMode}
                        />
                    </Suspense>
                </>
            )}
        </>
    )
}
