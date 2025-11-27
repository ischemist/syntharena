import { Suspense } from 'react'
import type { Metadata } from 'next'
import { connection } from 'next/server'

import { BenchmarkList } from './_components/server/benchmark-list'
import { BenchmarkListSkeleton } from './_components/skeletons'

export const metadata: Metadata = {
    title: 'Benchmark Sets',
    description: 'Browse retrosynthesis benchmark datasets with ground truth routes.',
}

/**
 * Main benchmarks page showing all available benchmark sets.
 * Uses streaming with Suspense for instant layout render.
 */
export default async function BenchmarksPage() {
    await connection()
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Benchmark Sets</h1>
                <p className="text-muted-foreground">
                    Browse retrosynthesis benchmark datasets with ground truth routes
                </p>
            </div>

            <Suspense fallback={<BenchmarkListSkeleton />}>
                <BenchmarkList />
            </Suspense>
        </div>
    )
}
