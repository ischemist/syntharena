import { Suspense } from 'react'
import type { Metadata } from 'next'

import { RunList } from './_components/server/run-list'
import { RunListSkeleton } from './_components/skeletons'

export const metadata: Metadata = {
    title: 'Model Runs',
    description: 'Browse prediction runs from retrosynthesis models.',
}

type PageProps = {
    searchParams: Promise<{
        benchmark?: string
        model?: string
        page?: string
    }>
}

export default function RunsPage({ searchParams }: PageProps) {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Model Runs</h1>
                <p className="text-muted-foreground">Browse prediction runs from retrosynthesis models</p>
            </div>

            <Suspense fallback={<RunListSkeleton />}>
                <RunList searchParams={searchParams} />
            </Suspense>
        </div>
    )
}
