import { Suspense } from 'react'
import type { Metadata } from 'next'
import { connection } from 'next/server'

import * as benchmarkView from '@/lib/services/view/benchmark.view'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { BenchmarkList } from './_components/server/benchmark-list'
import { BenchmarkListSkeleton } from './_components/skeletons'

export const metadata: Metadata = {
    title: 'Benchmark Sets',
    description: 'Browse retrosynthesis benchmark datasets with ground truth routes.',
}

export default async function BenchmarksPage() {
    await connection()
    const allBenchmarks = await benchmarkView.getBenchmarkSets()

    const marketBenchmarks = allBenchmarks.filter((b) => b.series === 'MARKET')
    const referenceBenchmarks = allBenchmarks.filter((b) => b.series === 'REFERENCE')
    const otherBenchmarks = allBenchmarks.filter((b) => b.series === 'LEGACY' || b.series === 'OTHER')

    return (
        <div className="flex flex-col gap-6">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Benchmark Sets</h1>
                <p className="text-muted-foreground">
                    Browse retrosynthesis benchmark datasets with ground truth routes
                </p>
            </div>

            <Tabs defaultValue="market">
                <TabsList>
                    <TabsTrigger value="market">Market Series</TabsTrigger>
                    <TabsTrigger value="reference">Reference Series</TabsTrigger>
                    <TabsTrigger value="other">Other</TabsTrigger>
                </TabsList>
                <TabsContent value="market">
                    <Suspense fallback={<BenchmarkListSkeleton />}>
                        <BenchmarkList benchmarks={marketBenchmarks} />
                    </Suspense>
                </TabsContent>
                <TabsContent value="reference">
                    <Suspense fallback={<BenchmarkListSkeleton />}>
                        <BenchmarkList benchmarks={referenceBenchmarks} />
                    </Suspense>
                </TabsContent>
                <TabsContent value="other">
                    <Suspense fallback={<BenchmarkListSkeleton />}>
                        <BenchmarkList benchmarks={otherBenchmarks} />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </div>
    )
}
