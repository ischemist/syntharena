import { Skeleton } from '@/components/ui/skeleton'
import { ModelInstanceTableSkeleton } from '@/app/algorithms/[slug]/_components/skeletons'

export function ModelFamilyDetailHeaderSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-5 w-full max-w-2xl" />
            <Skeleton className="h-5 w-48" />
        </div>
    )
}

export function ModelFamilyDetailSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <ModelFamilyDetailHeaderSkeleton />
            <ModelInstanceTableSkeleton />
        </div>
    )
}
