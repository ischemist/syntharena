import { Suspense } from 'react'
import type { Metadata } from 'next'

import * as predictionView from '@/lib/services/view/prediction.view'

import { EvaluationSelector } from './_components/client/evaluation-selector'
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
        evaluation?: string
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
    const [{ runId }, searchParamsValues] = await Promise.all([params, searchParams])

    const titleCardPromise = predictionView.getRunTitleCardData(runId)
    const evaluationsPromise = predictionView.getEvaluationsForRun(runId)

    // --- Data Orchestration ---
    const defaults = await predictionView.getRunDefaults(
        runId,
        searchParamsValues.evaluation,
        searchParamsValues.target
    )
    const evaluationId = searchParamsValues.evaluation ?? defaults.evaluationId
    const targetId = searchParamsValues.target ?? defaults.targetId
    const rank = parseInt(searchParamsValues.rank || '1', 10)
    const layout = searchParamsValues.layout
    const routeLength = searchParamsValues.routeLength
    const acceptableIndex = searchParamsValues.acceptableIndex
        ? parseInt(searchParamsValues.acceptableIndex, 10)
        : undefined
    const onlyWithPredictions = searchParamsValues.onlyWithPredictions === 'true'

    // Initiate all data fetches concurrently. Do NOT await them here.
    const statsPromise = evaluationId ? predictionView.getRunStatistics(runId, evaluationId) : Promise.resolve(null)
    const targetDisplayDataPromise = targetId
        ? predictionView.getTargetDisplayData(runId, targetId, rank, evaluationId, acceptableIndex, layout)
        : null

    return (
        <div className="flex flex-col gap-6">
            <Suspense fallback={<div className="bg-card h-48 animate-pulse rounded-lg" />}>
                <RunTitleCard dataPromise={titleCardPromise} />
            </Suspense>

            <Suspense fallback={<div className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />}>
                <EvaluationSelectorWrapper evaluationsPromise={evaluationsPromise} currentEvaluationId={evaluationId} />
            </Suspense>

            <Suspense fallback={<RunStatisticsSkeleton />}>
                <RunStatisticsSummary dataPromise={statsPromise} evaluationId={evaluationId} />
            </Suspense>

            <Suspense fallback={<StratifiedStatisticsSkeleton />}>
                <RunStatisticsStratified dataPromise={statsPromise} evaluationId={evaluationId} />
            </Suspense>

            <TargetSearchWrapper
                runId={runId}
                currentTargetId={targetId}
                routeLength={routeLength}
                onlyWithPredictions={onlyWithPredictions}
            />
            {targetDisplayDataPromise && (
                <Suspense
                    key={`${targetId}-${rank}-${evaluationId}-${layout}-${acceptableIndex}`}
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
async function EvaluationSelectorWrapper({
    evaluationsPromise,
    currentEvaluationId,
}: {
    evaluationsPromise: Promise<Awaited<ReturnType<typeof predictionView.getEvaluationsForRun>>>
    currentEvaluationId?: string
}) {
    const evaluations = await evaluationsPromise
    if (evaluations.length <= 1) return null
    return <EvaluationSelector evaluations={evaluations} currentEvaluationId={currentEvaluationId} />
}
