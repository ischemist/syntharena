import { AlgorithmListSkeleton } from './_components/skeletons'

/**
 * Loading shell for algorithms list page.
 * Provides instant full-page layout before data loads.
 */
export default function AlgorithmsLoading() {
    return (
        <div className="flex flex-col gap-6">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Algorithms</h1>
                <p className="text-muted-foreground">Browse retrosynthesis algorithms and their model versions</p>
            </div>
            <AlgorithmListSkeleton />
        </div>
    )
}
