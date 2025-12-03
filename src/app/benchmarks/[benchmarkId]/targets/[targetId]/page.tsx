import { Suspense, use } from 'react'
import type { Metadata } from 'next'

import { getBenchmarkById, getTargetById } from '@/lib/services/benchmark.service'
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
        view?: string
        acceptableIndex?: string
    }>
}

export async function generateMetadata({ params }: TargetDetailPageProps): Promise<Metadata> {
    const { benchmarkId, targetId } = await params
    const [benchmark, target] = await Promise.all([getBenchmarkById(benchmarkId), getTargetById(targetId)])

    const title = `${target?.targetId || 'Target'} - ${benchmark?.name || 'Benchmark'}`

    return {
        title,
        description: 'View ground truth route and compare with model predictions.',
    }
}

/**
 * Target detail page showing target molecule and ground truth route.
 * Now supports comparison with model predictions via URL search params.
 * Remains synchronous per the app router manifesto, unwrapping promises with use().
 * Delegates data fetching to async server components wrapped in Suspense boundaries.
 * Target header and route display load independently via streaming.
 */
export default function TargetDetailPage(props: TargetDetailPageProps) {
    // ORTHODOXY: Unwrap promises in sync component (Next.js 15 pattern)
    const params = use(props.params)
    const searchParams = use(props.searchParams)

    const { benchmarkId, targetId } = params

    return (
        <div className="flex flex-col gap-6">
            {/* Target header with molecule structure */}
            <Suspense fallback={<TargetDetailSkeleton />}>
                <TargetHeader targetId={targetId} />
            </Suspense>

            {/* Route visualization with comparison support */}
            <Suspense
                key={`${searchParams.mode}-${searchParams.model1}-${searchParams.model2}-${searchParams.rank1}-${searchParams.rank2}-${searchParams.view}-${searchParams.acceptableIndex}`}
                fallback={
                    <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-6 dark:border-gray-800 dark:bg-gray-900/50">
                        <Skeleton className="h-[600px] w-full" />
                    </div>
                }
            >
                <RouteDisplayWithComparison
                    targetId={targetId}
                    benchmarkId={benchmarkId}
                    mode={searchParams.mode}
                    model1Id={searchParams.model1}
                    model2Id={searchParams.model2}
                    rank1={searchParams.rank1 ? parseInt(searchParams.rank1, 10) : 1}
                    rank2={searchParams.rank2 ? parseInt(searchParams.rank2, 10) : 1}
                    viewMode={searchParams.view}
                    acceptableIndex={searchParams.acceptableIndex ? parseInt(searchParams.acceptableIndex, 10) : 0}
                />
            </Suspense>
        </div>
    )
}
