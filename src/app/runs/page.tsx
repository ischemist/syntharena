import { Suspense } from 'react'
import type { Metadata } from 'next'

import * as benchmarkView from '@/lib/services/view/benchmark.view'
import * as predictionView from '@/lib/services/view/prediction.view'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { RunFilters } from './_components/client/run-filters'
import { RunList } from './_components/server/run-list'
import { RunListSkeleton } from './_components/skeletons'

export const metadata: Metadata = {
    title: 'Model Runs',
    description: 'Browse prediction runs from retrosynthesis models.',
}

type PageProps = {
    searchParams: Promise<{
        benchmark?: string
        family?: string
    }>
}

export default async function RunsPage({ searchParams }: PageProps) {
    const params = await searchParams

    // Fetch all data concurrently
    const [allRuns, benchmarks, modelFamilies] = await Promise.all([
        predictionView.getPredictionRuns(params.benchmark, params.family),
        benchmarkView.getBenchmarkSets(),
        predictionView.getModelFamiliesWithRuns(),
    ])

    const marketRuns = allRuns.filter((r) => r.benchmarkSet.series === 'MARKET')
    const referenceRuns = allRuns.filter((r) => r.benchmarkSet.series === 'REFERENCE')
    const otherRuns = allRuns.filter((r) => r.benchmarkSet.series === 'LEGACY' || r.benchmarkSet.series === 'OTHER')

    return (
        <div className="flex flex-col gap-6">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Model Runs</h1>
                <p className="text-muted-foreground">Browse and filter prediction runs from retrosynthesis models.</p>
            </div>

            <RunFilters benchmarks={benchmarks} modelFamilies={modelFamilies} />

            <Tabs defaultValue="market">
                <TabsList>
                    <TabsTrigger value="market">Market Series</TabsTrigger>
                    <TabsTrigger value="reference">Reference Series</TabsTrigger>
                    <TabsTrigger value="other">Other</TabsTrigger>
                </TabsList>

                <TabsContent value="market">
                    {marketRuns.length > 0 ? (
                        <RunList runs={marketRuns} />
                    ) : (
                        <EmptyState message="No prediction runs found for the Market series." />
                    )}
                </TabsContent>
                <TabsContent value="reference">
                    {referenceRuns.length > 0 ? (
                        <RunList runs={referenceRuns} />
                    ) : (
                        <EmptyState message="No prediction runs found for the Reference series." />
                    )}
                </TabsContent>
                <TabsContent value="other">
                    {otherRuns.length > 0 ? (
                        <RunList runs={otherRuns} />
                    ) : (
                        <EmptyState message="No prediction runs found for the Other series." />
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="text-muted-foreground rounded-lg border border-dashed py-12 text-center">
            <p>{message}</p>
            <p className="mt-2 text-sm">Load prediction data or adjust filters.</p>
        </div>
    )
}
