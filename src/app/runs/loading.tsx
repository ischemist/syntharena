import { RunListSkeleton } from './_components/skeletons'

export default function Loading() {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <div className="bg-muted h-9 w-48 animate-pulse rounded" />
                <div className="bg-muted mt-2 h-5 w-96 animate-pulse rounded" />
            </div>
            <RunListSkeleton />
        </div>
    )
}
