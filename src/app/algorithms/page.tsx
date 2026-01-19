import { Suspense } from 'react'
import type { Metadata } from 'next'
import { connection } from 'next/server'

import { AlgorithmList } from './_components/server/algorithm-list'
import { AlgorithmListSkeleton } from './_components/skeletons'

export const metadata: Metadata = {
    title: 'Algorithms',
    description: 'Browse retrosynthesis algorithms and their model versions.',
}

/**
 * Main algorithms page showing all available algorithms.
 * Uses streaming with Suspense for instant layout render.
 */
export default async function AlgorithmsPage() {
    await connection()
    return (
        <div className="flex flex-col gap-6">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Algorithms</h1>
                <p className="text-muted-foreground">Browse retrosynthesis algorithms and their model versions</p>
            </div>

            <Suspense fallback={<AlgorithmListSkeleton />}>
                <AlgorithmList />
            </Suspense>
        </div>
    )
}
