import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'

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
        routeLength?: string
        acceptableIndex?: string
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
 * Wrapper for StockSelector - fetches stocks and handles auto-selection server-side
 */
export async function StockSelectorWrapper({ params, searchParams }: ParamsProps & SearchParamsProps) {
    const { runId } = await params
    const searchParamsResolved = await searchParams

    // Parse route length filter for consistent navigation
    const routeLengthFilter = searchParamsResolved.routeLength
        ? parseInt(searchParamsResolved.routeLength, 10)
        : undefined

    const [stocks, targetIds] = await Promise.all([getStocksForRun(runId), getTargetIdsByRun(runId, routeLengthFilter)])

    // Server-side auto-selection: If no stock param exists but stocks are available, redirect with first stock
    if (!searchParamsResolved.stock && stocks.length > 0) {
        const params = new URLSearchParams(searchParamsResolved as Record<string, string>)
        params.set('stock', stocks[0].id)

        // Auto-select first target if none selected
        if (!searchParamsResolved.target && targetIds[0]) {
            params.set('target', targetIds[0])
            params.set('rank', '1')
        }

        redirect(`?${params.toString()}`)
    }

    // Hide selector if only one stock
    if (stocks.length <= 1) {
        return null
    }

    // Pass data to client component
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
    const routeLength = searchParamsResolved.routeLength
    const acceptableIndex = searchParamsResolved.acceptableIndex
        ? parseInt(searchParamsResolved.acceptableIndex, 10)
        : undefined

    return (
        <>
            {/* Target search */}
            <TargetSearchWrapper runId={runId} stockId={stockId} currentTargetId={targetId} routeLength={routeLength} />

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
                    <Suspense
                        key={`${targetId}-${rank}-${viewMode}-${acceptableIndex}`}
                        fallback={<RouteDisplaySkeleton />}
                    >
                        <TargetRouteGraphDisplay
                            runId={runId}
                            targetId={targetId}
                            rank={rank}
                            stockId={stockId}
                            viewMode={viewMode}
                            acceptableIndex={acceptableIndex}
                        />
                    </Suspense>
                </>
            )}
        </>
    )
}
