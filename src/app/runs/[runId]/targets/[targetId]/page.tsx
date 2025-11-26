import { Suspense } from 'react'
import { notFound } from 'next/navigation'

import { getTargetPredictions } from '@/lib/services/prediction.service'

import { StockSelector } from '../../_components/client/stock-selector'
import { RouteList } from './_components/server/route-list'
import { TargetDetailHeader } from './_components/server/target-detail-header'
import { RouteListSkeleton } from './_components/skeletons'

type PageProps = {
    params: Promise<{ runId: string; targetId: string }>
    searchParams: Promise<{ stock?: string }>
}

export default async function TargetDetailPage({ params, searchParams }: PageProps) {
    const { runId, targetId } = await params
    const target = await getTargetPredictions(targetId, runId)

    if (!target) {
        notFound()
    }

    return (
        <div className="flex flex-col gap-6">
            <TargetDetailHeader target={target} runId={runId} />

            <StockSelector />

            <Suspense fallback={<RouteListSkeleton />}>
                <RouteList targetId={targetId} runId={runId} searchParams={searchParams} />
            </Suspense>
        </div>
    )
}
