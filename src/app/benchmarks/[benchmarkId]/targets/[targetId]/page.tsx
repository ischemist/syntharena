import { Suspense, use } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

import { RouteDisplay } from './_components/server/route-display'
import { TargetHeader } from './_components/server/target-header'
import { TargetDetailSkeleton } from './_components/skeletons'

interface TargetDetailPageProps {
    params: Promise<{ benchmarkId: string; targetId: string }>
}

/**
 * Target detail page showing target molecule and ground truth route.
 * Remains synchronous per the app router manifesto, unwrapping promises with use().
 * Delegates data fetching to async server components wrapped in Suspense boundaries.
 * Target header and route display load independently via streaming.
 */
export default function TargetDetailPage(props: TargetDetailPageProps) {
    // ORTHODOXY: Unwrap promises in sync component (Next.js 15 pattern)
    const params = use(props.params)

    const { benchmarkId, targetId } = params

    return (
        <div className="space-y-6">
            {/* Target header with molecule structure */}
            <Suspense fallback={<TargetDetailSkeleton />}>
                <TargetHeader benchmarkId={benchmarkId} targetId={targetId} />
            </Suspense>

            {/* Route visualization */}
            <Suspense
                fallback={
                    <Card>
                        <CardContent className="p-6">
                            <Skeleton className="h-[400px] w-full" />
                        </CardContent>
                    </Card>
                }
            >
                <RouteDisplay targetId={targetId} />
            </Suspense>
        </div>
    )
}
