import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'

import type { TargetComparisonData } from '@/types'
import { getBenchmarkById, getTargetById } from '@/lib/services/view/benchmark.view'
import { getTargetComparisonData } from '@/lib/services/view/route.view'
import {
    resolveBenchmarkTargetUrlKey,
    resolveBenchmarkUrlKey,
    resolveTargetComparisonRoute,
} from '@/lib/routing/url-resolver'
import { Skeleton } from '@/components/ui/skeleton'

import { RouteDisplayWithComparison } from './_components/server/route-display-with-comparison'
import { TargetHeader } from './_components/server/target-header'
import { TargetDetailSkeleton } from './_components/skeletons'

interface TargetDetailPageProps {
    params: Promise<{ benchmarkId: string; targetId: string }>
    searchParams: Promise<{
        mode?: string
        model1?: string
        model2?: string
        rank1?: string
        rank2?: string
        layout?: string
        acceptableIndex?: string
        dev?: string
        [key: string]: string | string[] | undefined
    }>
}

export async function generateMetadata({ params }: TargetDetailPageProps): Promise<Metadata> {
    const { benchmarkId, targetId } = await params
    const benchmarkDestination = await resolveBenchmarkUrlKey(benchmarkId)
    if (!benchmarkDestination) return { title: 'Target Not Found' }
    const targetDestination = await resolveBenchmarkTargetUrlKey(benchmarkDestination.id, targetId)
    if (!targetDestination) return { title: 'Target Not Found' }
    const [benchmark, target] = await Promise.all([
        getBenchmarkById(benchmarkDestination.id),
        getTargetById(targetDestination.id),
    ])
    const title = `${target?.targetId || 'Target'} - ${benchmark?.name || 'Benchmark'}`
    return {
        title,
        description: 'View ground truth route and compare with model predictions.',
        alternates: {
            canonical: `/benchmarks/${benchmarkDestination.slug}/targets/${targetDestination.id}`,
        },
    }
}

export default async function TargetDetailPage({ params, searchParams }: TargetDetailPageProps) {
    const [{ benchmarkId, targetId }, searchParamsValues] = await Promise.all([params, searchParams])
    const route = await resolveTargetComparisonRoute(benchmarkId, targetId, searchParamsValues)
    if (!route) notFound()
    if (route.needsRedirect) permanentRedirect(route.canonicalUrl)
    const { benchmark: benchmarkDestination, target: targetDestination, search: canonicalSearch } = route

    const mode = canonicalSearch.get('mode') ?? undefined
    const model1 = canonicalSearch.get('model1') ?? undefined
    const model2 = canonicalSearch.get('model2') ?? undefined
    const layout = canonicalSearch.get('layout') ?? undefined
    const rank1 = canonicalSearch.get('rank1') ?? undefined
    const rank2 = canonicalSearch.get('rank2') ?? undefined
    const acceptableIndex = canonicalSearch.get('acceptableIndex') ?? undefined
    const dev = canonicalSearch.get('dev') ?? undefined
    const devMode = dev === 'true'

    // Fetch ALL data for the page with a single, parallelized call.
    const comparisonDataPromise = getTargetComparisonData(
        targetDestination.id,
        benchmarkDestination.id,
        mode,
        model1,
        model2,
        rank1 ? parseInt(rank1, 10) : 1,
        rank2 ? parseInt(rank2, 10) : 1,
        layout,
        acceptableIndex ? parseInt(acceptableIndex, 10) : 0,
        devMode
    )

    return (
        <div className="flex flex-col gap-6">
            <Suspense fallback={<TargetDetailSkeleton />}>
                <TargetHeader targetId={targetDestination.id} />
            </Suspense>

            <Suspense
                key={`${mode}-${model1}-${model2}-${rank1}-${rank2}-${layout}-${acceptableIndex}-${dev ?? 'false'}`}
                fallback={<Skeleton className="h-[800px] w-full rounded-lg" />}
            >
                <ResolvedComparison dataPromise={comparisonDataPromise} />
            </Suspense>
        </div>
    )
}

// Helper component to resolve the promise inside the Suspense boundary
async function ResolvedComparison({ dataPromise }: { dataPromise: Promise<TargetComparisonData> }) {
    const data = await dataPromise
    return <RouteDisplayWithComparison data={data} />
}
