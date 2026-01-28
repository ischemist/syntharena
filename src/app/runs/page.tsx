// src/app/runs/page.tsx
import type { Metadata } from 'next'

import type { PredictionRunWithStats, SubmissionType } from '@/types'
import * as predictionView from '@/lib/services/view/prediction.view'
import { DeveloperModeToggle } from '@/components/developer-mode-toggle'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { RunFilters } from './_components/client/run-filters'
import { RunDataTable } from './_components/server/run-list'
import { RunsPageHeader } from './_components/server/runs-page-header'

export const metadata: Metadata = {
    title: 'Model Runs',
    description: 'Browse prediction runs from retrosynthesis models.',
}

type PageProps = {
    searchParams: Promise<{
        families?: string
        submission?: string
        dev?: string
    }>
}

export default async function RunsPage({ searchParams }: PageProps) {
    const params = await searchParams
    const familyIds = params.families?.split(',')
    const submission = params.submission as SubmissionType | undefined
    const devMode = params.dev === 'true'

    // Fetch all data concurrently
    const [allRuns, modelFamilies] = await Promise.all([
        predictionView.getPredictionRuns(undefined, undefined, familyIds, submission, devMode),
        predictionView.getModelFamiliesWithRuns(),
    ])

    const runsBySeries = {
        market: allRuns.filter((r) => r.benchmarkSet.series === 'MARKET'),
        reference: allRuns.filter((r) => r.benchmarkSet.series === 'REFERENCE'),
        other: allRuns.filter((r) => r.benchmarkSet.series === 'LEGACY' || r.benchmarkSet.series === 'OTHER'),
    }

    const familyOptions = modelFamilies.map((f) => ({ value: f.id, label: f.name }))

    // --- CHANGE: The page structure is now orchestrated by the new header. ---
    // The <Tabs> component wraps the entire content area to provide context.
    return (
        <Tabs defaultValue="market" className="flex flex-col gap-6">
            <RunsPageHeader>
                {/* Tabs - full width on mobile/tablet, auto on desktop */}
                <TabsList className="w-full md:w-auto">
                    <TabsTrigger value="market">Market Series</TabsTrigger>
                    <TabsTrigger value="reference">Reference Series</TabsTrigger>
                    <TabsTrigger value="other">Other</TabsTrigger>
                </TabsList>
                {/* Filters - full width on mobile/tablet, auto on desktop */}
                <div className="flex w-full flex-wrap items-center gap-4 xl:w-auto">
                    <RunFilters modelFamilies={familyOptions} />
                    <DeveloperModeToggle />
                </div>
            </RunsPageHeader>

            <TabsContent value="market" className="mt-0">
                <RunListDisplay
                    runs={runsBySeries.market}
                    emptyMessage="No Market series runs match the current filters."
                />
            </TabsContent>
            <TabsContent value="reference" className="mt-0">
                <RunListDisplay
                    runs={runsBySeries.reference}
                    emptyMessage="No Reference series runs match the current filters."
                />
            </TabsContent>
            <TabsContent value="other" className="mt-0">
                <RunListDisplay
                    runs={runsBySeries.other}
                    emptyMessage="No Other series runs match the current filters."
                />
            </TabsContent>
        </Tabs>
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
