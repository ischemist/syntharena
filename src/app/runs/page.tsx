import { Suspense } from 'react'
import type { Metadata } from 'next'

import type { PredictionRunWithStats, SubmissionType } from '@/types'
import * as predictionView from '@/lib/services/view/prediction.view'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { RunFilters } from './_components/client/run-filters'
import { RunDataTable } from './_components/server/run-list' // Renamed from RunList to RunDataTable
import { RunListSkeleton } from './_components/skeletons'

export const metadata: Metadata = {
    title: 'Model Runs',
    description: 'Browse prediction runs from retrosynthesis models.',
}

type PageProps = {
    searchParams: Promise<{
        families?: string
        submission?: string
    }>
}

export default async function RunsPage({ searchParams }: PageProps) {
    const params = await searchParams
    const familyIds = params.families?.split(',')
    const submission = params.submission as SubmissionType | undefined

    // Fetch all data concurrently
    const [allRuns, modelFamilies] = await Promise.all([
        predictionView.getPredictionRuns(undefined, undefined, familyIds, submission),
        predictionView.getModelFamiliesWithRuns(),
    ])

    const runsBySeries = {
        market: allRuns.filter((r) => r.benchmarkSet.series === 'MARKET'),
        reference: allRuns.filter((r) => r.benchmarkSet.series === 'REFERENCE'),
        other: allRuns.filter((r) => r.benchmarkSet.series === 'LEGACY' || r.benchmarkSet.series === 'OTHER'),
    }

    const runsByBenchmark = (runs: typeof allRuns) =>
        runs.reduce(
            (acc, run) => {
                const benchmarkName = run.benchmarkSet.name
                if (!acc[benchmarkName]) acc[benchmarkName] = []
                acc[benchmarkName].push(run)
                return acc
            },
            {} as Record<string, typeof allRuns>
        )

    const familyOptions = modelFamilies.map((f) => ({ value: f.id, label: f.name }))

    return (
        <div className="flex flex-col gap-6">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Model Runs</h1>
                <p className="text-muted-foreground">Browse and filter prediction runs from retrosynthesis models.</p>
            </div>

            <RunFilters modelFamilies={familyOptions} />

            <Tabs defaultValue="market">
                <TabsList>
                    <TabsTrigger value="market">Market Series</TabsTrigger>
                    <TabsTrigger value="reference">Reference Series</TabsTrigger>
                    <TabsTrigger value="other">Other</TabsTrigger>
                </TabsList>
                <TabsContent value="market">
                    <RunListDisplay
                        runs={runsBySeries.market}
                        emptyMessage="No Market series runs match the current filters."
                    />
                </TabsContent>
                <TabsContent value="reference">
                    <RunListDisplay
                        runs={runsBySeries.reference}
                        emptyMessage="No Reference series runs match the current filters."
                    />
                </TabsContent>
                <TabsContent value="other">
                    <RunListDisplay
                        runs={runsBySeries.other}
                        emptyMessage="No Other series runs match the current filters."
                    />
                </TabsContent>
            </Tabs>
        </div>
    )
}

function RunListDisplay({ runs, emptyMessage }: { runs: PredictionRunWithStats[]; emptyMessage: string }) {
    if (runs.length === 0) {
        return <EmptyState message={emptyMessage} />
    }

    const groupedRuns = runs.reduce(
        (acc, run) => {
            const benchmarkName = run.benchmarkSet.name
            if (!acc[benchmarkName]) acc[benchmarkName] = []
            acc[benchmarkName].push(run)
            return acc
        },
        {} as Record<string, typeof runs>
    )

    return (
        <div className="space-y-8">
            {Object.entries(groupedRuns).map(([benchmarkName, benchmarkRuns]) => (
                <div key={benchmarkName} className="space-y-3">
                    <h2 className="text-xl font-semibold">{benchmarkName}</h2>
                    <RunDataTable runs={benchmarkRuns} />
                </div>
            ))}
        </div>
    )
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="text-muted-foreground rounded-lg border border-dashed py-12 text-center">
            <p>{message}</p>
        </div>
    )
}
