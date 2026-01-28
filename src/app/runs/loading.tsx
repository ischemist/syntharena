import { Skeleton } from '@/components/ui/skeleton'

import { RunListSkeleton } from './_components/skeletons'

export default function Loading() {
    return (
        <div className="flex flex-col gap-6">
            {/* Header skeleton */}
            <div className="space-y-1">
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-5 w-96" />
            </div>
            {/* Controls skeleton - responsive layout */}
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <Skeleton className="h-10 w-full md:w-[320px] xl:w-[320px]" /> {/* Tabs skeleton */}
                <Skeleton className="h-10 w-full xl:w-[600px]" /> {/* Filters skeleton */}
            </div>
            {/* Content skeleton */}
            <RunListSkeleton />
        </div>
    )
}
