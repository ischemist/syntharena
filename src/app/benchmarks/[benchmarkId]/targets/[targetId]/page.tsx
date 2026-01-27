import { Suspense } from 'react'
import type { Metadata } from 'next'

import type { TargetComparisonData } from '@/types'
import { getBenchmarkById, getTargetById } from '@/lib/services/view/benchmark.view'
import { getTargetComparisonData } from '@/lib/services/view/route.view'
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
    }>
}

export async function generateMetadata({ params }: TargetDetailPageProps): Promise<Metadata> {
    const { benchmarkId, targetId } = await params
    const [benchmark, target] = await Promise.all([getBenchmarkById(benchmarkId), getTargetById(targetId)])
    const title = `${target?.targetId || 'Target'} - ${benchmark?.name || 'Benchmark'}`
    return { title, description: 'View ground truth route and compare with model predictions.' }
}

export default async function TargetDetailPage({ params, searchParams }: TargetDetailPageProps) {
    const { benchmarkId, targetId } = await params
    const { mode, model1, model2, layout, rank1, rank2, acceptableIndex, dev } = await searchParams
    const devMode = dev === 'true'

    // Fetch ALL data for the page with a single, parallelized call.
    const comparisonDataPromise = getTargetComparisonData(
        targetId,
        benchmarkId,
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
                <TargetHeader targetId={targetId} />
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
