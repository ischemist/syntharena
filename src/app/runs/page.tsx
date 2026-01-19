import { Suspense } from 'react'
import type { Metadata } from 'next'

import * as predictionView from '@/lib/services/view/prediction.view'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

export default async function RunsPage({ searchParams }: PageProps) {
    const params = await searchParams
    const allRuns = await predictionView.getPredictionRuns(params.benchmark, params.model)

    const marketRuns = allRuns.filter((r) => r.benchmarkSet.series === 'MARKET')
    const referenceRuns = allRuns.filter((r) => r.benchmarkSet.series === 'REFERENCE')
    const otherRuns = allRuns.filter((r) => r.benchmarkSet.series === 'LEGACY' || r.benchmarkSet.series === 'OTHER')

    return (
        <div className="flex flex-col gap-6">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Model Runs</h1>
                <p className="text-muted-foreground">Browse prediction runs from retrosynthesis models</p>
            </div>

            <Tabs defaultValue="market">
                <TabsList>
                    <TabsTrigger value="market">Market Series</TabsTrigger>
                    <TabsTrigger value="reference">Reference Series</TabsTrigger>
                    <TabsTrigger value="other">Other</TabsTrigger>
                </TabsList>
                <TabsContent value="market">
                    <Suspense fallback={<RunListSkeleton />}>
                        <RunList runs={marketRuns} />
                    </Suspense>
                </TabsContent>
                <TabsContent value="reference">
                    <Suspense fallback={<RunListSkeleton />}>
                        <RunList runs={referenceRuns} />
                    </Suspense>
                </TabsContent>
                <TabsContent value="other">
                    <Suspense fallback={<RunListSkeleton />}>
                        <RunList runs={otherRuns} />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </div>
    )
}
