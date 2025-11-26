import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

import { RunStatisticsSkeleton, TargetGridSkeleton } from './_components/skeletons'

export default function Loading() {
    return (
        <div className="flex flex-col gap-6">
            {/* Header skeleton */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-64" />
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i}>
                            <Skeleton className="mb-2 h-4 w-24" />
                            <Skeleton className="h-6 w-32" />
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Stock selector skeleton */}
            <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-10 w-[200px]" />
            </div>

            <RunStatisticsSkeleton />

            {/* Filter bar skeleton */}
            <Card>
                <CardContent className="pt-6">
                    <Skeleton className="h-8 w-full" />
                </CardContent>
            </Card>

            <TargetGridSkeleton />
        </div>
    )
}
