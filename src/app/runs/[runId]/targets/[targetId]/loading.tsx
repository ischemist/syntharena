import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

import { RouteListSkeleton } from './_components/skeletons'

export default function Loading() {
    return (
        <div className="flex flex-col gap-6">
            {/* Breadcrumb skeleton */}
            <Skeleton className="h-5 w-96" />

            {/* Header skeleton */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Skeleton className="mb-2 h-4 w-16" />
                        <Skeleton className="h-4 w-full" />
                    </div>
                    <div className="flex gap-4">
                        <Skeleton className="h-16 w-32" />
                        <Skeleton className="h-16 w-32" />
                        <Skeleton className="h-16 w-32" />
                    </div>
                </CardContent>
            </Card>

            {/* Stock selector skeleton */}
            <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-10 w-[200px]" />
            </div>

            <RouteListSkeleton />
        </div>
    )
}
