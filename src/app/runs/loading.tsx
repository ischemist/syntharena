import { Skeleton } from '@/components/ui/skeleton'

import { RunListSkeleton } from './_components/skeletons'

export default function Loading() {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <Skeleton className="h-9 w-48" />
                <Skeleton className="mt-2 h-5 w-96" />
            </div>
            <Skeleton className="h-[72px] w-full" /> {/* Filter bar skeleton */}
            <div className="space-y-4">
                <Skeleton className="h-10 w-[320px]" /> {/* Tabs skeleton */}
                <RunListSkeleton />
            </div>
        </div>
    )
}
