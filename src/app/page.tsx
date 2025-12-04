import { Suspense } from 'react'

import { BenchmarksOverviewSection } from './_components/server/benchmarks-overview-section'
import { HeaderSection } from './_components/server/header-section'
import { LiveStatsSection } from './_components/server/live-stats-section'
import { NavigationSection } from './_components/server/navigation-section'
import { ProblemSolutionSection } from './_components/server/problem-solution-section'
import { BenchmarksTableSkeleton, StatsTableSkeleton } from './_components/skeletons'

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
