import { Suspense } from 'react'
import type { Metadata } from 'next'

import { getLeaderboardPageData, type LeaderboardPageData } from '@/lib/services/view/leaderboard.view' // only view import needed

import { PageLevelTopKSelector } from './_components/client/page-level-top-k-selector'
import { StratifiedMetricsFilter } from './_components/client/stratified-metrics-filter'
import { BenchmarkLeaderboardHeader } from './_components/server/benchmark-leaderboard-header'
import { BenchmarkLeaderboardOverall } from './_components/server/benchmark-leaderboard-overall'
import { BenchmarkParetoDisplay } from './_components/server/benchmark-pareto-display'
import { StratifiedMetricCard } from './_components/server/stratified-metric-card'
import { LeaderboardCardSkeleton, ParetoChartSkeleton } from './_components/skeletons'

export const metadata: Metadata = {
    title: 'Leaderboard',
    description: 'Compare model performance across retrosynthesis benchmarks.',
}

type LeaderboardPageProps = {
    searchParams: Promise<{ benchmarkId?: string }>
}

/**
 * [REFACTORED] Leaderboard page for comparing model performance across benchmarks.
 * Uses a single, unified data fetch to prevent waterfalls.
 * The page itself is async, calling the orchestrator and passing data down.
 */
export default function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
    return (
        <div className="flex flex-col gap-6">
            <Suspense fallback={<LeaderboardCardSkeleton />}>
                <LeaderboardContentWrapper searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

/**
 * Async component that performs the single data fetch for the page.
 */
async function LeaderboardContentWrapper({
    searchParams,
}: {
    searchParams: Promise<{ benchmarkId?: string; dev?: string }>
}) {
    const params = await searchParams
    const devMode = params.dev === 'true'
    const pageData = await getLeaderboardPageData(params.benchmarkId, devMode)

    if (!pageData) {
        return (
            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
                <p>No benchmarks available.</p>
                <p className="mt-2 text-sm">Create a benchmark to see leaderboard data.</p>
            </div>
        )
    }

    const { leaderboardEntries, stratifiedMetricsByStock, stocks, metadata, allBenchmarks, selectedBenchmark } =
        pageData
    const { hasAcceptableRoutes, availableTopKMetrics } = metadata

    return (
        <>
            <BenchmarkLeaderboardHeader benchmark={selectedBenchmark} benchmarks={allBenchmarks} />

            {leaderboardEntries.length === 0 ? (
                <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
                    <p>No leaderboard data available for this benchmark.</p>
                    <p className="mt-2 text-sm">Load model predictions and statistics to see comparisons.</p>
                </div>
            ) : (
                <LeaderboardMetrics
                    leaderboardEntries={leaderboardEntries}
                    selectedBenchmark={selectedBenchmark}
                    stratifiedMetricsByStock={stratifiedMetricsByStock}
                    stocks={stocks}
                    hasAcceptableRoutes={hasAcceptableRoutes}
                    availableTopKMetrics={availableTopKMetrics}
                />
            )}
        </>
    )
}

// Separate component for metrics to logically group them. It's not async.
function LeaderboardMetrics({
    leaderboardEntries,
    selectedBenchmark,
    stratifiedMetricsByStock,
    stocks,
    hasAcceptableRoutes,
    availableTopKMetrics,
}: Omit<LeaderboardPageData, 'allBenchmarks' | 'metadata' | 'firstTargetId'> & LeaderboardPageData['metadata']) {
    const stockName = leaderboardEntries[0].stockName

    if (!hasAcceptableRoutes || availableTopKMetrics.length === 0) {
        return (
            <div className="flex flex-col gap-6">
                <BenchmarkLeaderboardOverall
                    entries={leaderboardEntries}
                    benchmarkSeries={selectedBenchmark.series}
                    hasAcceptableRoutes={hasAcceptableRoutes}
                    stockName={stockName}
                    topKMetricNames={[]}
                />
                <StratifiedMetricsWrapper
                    metricsByStock={stratifiedMetricsByStock}
                    stocks={stocks}
                    metricNames={['Solvability']}
                />
            </div>
        )
    }

    return (
        <PageLevelTopKSelector topKMetricNames={availableTopKMetrics}>
            <div className="flex flex-col gap-6">
                <BenchmarkLeaderboardOverall
                    entries={leaderboardEntries}
                    benchmarkSeries={selectedBenchmark.series}
                    hasAcceptableRoutes={hasAcceptableRoutes}
                    stockName={stockName}
                    topKMetricNames={availableTopKMetrics}
                />
                <Suspense fallback={<ParetoChartSkeleton />}>
                    <BenchmarkParetoDisplay entries={leaderboardEntries} availableTopKMetrics={availableTopKMetrics} />
                </Suspense>
                <StratifiedMetricsWrapper
                    metricsByStock={stratifiedMetricsByStock}
                    stocks={stocks}
                    metricNames={['Solvability', ...availableTopKMetrics]}
                />
            </div>
        </PageLevelTopKSelector>
    )
}

/**
 * Stratified metrics renderer - remains unchanged but is now called from a different parent.
 */
function StratifiedMetricsWrapper({
    metricsByStock,
    stocks,
    metricNames,
}: {
    metricsByStock: LeaderboardPageData['stratifiedMetricsByStock']
    stocks: LeaderboardPageData['stocks']
    metricNames: string[]
}) {
    if (stocks.length === 0) {
        return null
    }

    return (
        <>
            {stocks.map((stock) => {
                const stockMetrics = metricsByStock.get(stock.id)
                if (!stockMetrics) return null

                return (
                    <div key={stock.id} className="flex flex-col gap-6">
                        {/* If multiple stocks, add a header here */}
                        {stocks.length > 1 && <h2 className="text-xl font-semibold">{stock.name} Metrics</h2>}

                        {metricNames.map((metricName) => (
                            <StratifiedMetricsFilter key={`${stock.id}-${metricName}`} metricName={metricName}>
                                <StratifiedMetricCard metricName={metricName} metricsMap={stockMetrics} />
                            </StratifiedMetricsFilter>
                        ))}
                    </div>
                )
            })}
        </>
    )
}
