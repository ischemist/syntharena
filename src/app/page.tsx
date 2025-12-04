import { Suspense } from 'react'

import { HeaderSection } from './_components/home/header-section'
import { NavigationSection } from './_components/home/navigation-section'
import { ProblemSolutionSection } from './_components/home/problem-solution-section'
import { BenchmarksOverviewSection } from './_components/home/server/benchmarks-overview-section'
import { LiveStatsSection } from './_components/home/server/live-stats-section'
import { BenchmarksTableSkeleton, StatsTableSkeleton } from './_components/home/skeletons'

export default function Home() {
    return (
        <div className="container mx-auto max-w-7xl space-y-0 py-8">
            <HeaderSection />
            <ProblemSolutionSection />
            <Suspense fallback={<StatsTableSkeleton />}>
                <LiveStatsSection />
            </Suspense>
            <Suspense fallback={<BenchmarksTableSkeleton />}>
                <BenchmarksOverviewSection />
            </Suspense>
            <NavigationSection />
        </div>
    )
}
