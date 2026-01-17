import { getBenchmarkSets } from '@/lib/services/view/benchmark.view'

import { BenchmarkCombobox } from '../client/benchmark-combobox'

type BenchmarkSelectorProps = {
    selectedId: string | null
}

/**
 * Server component that fetches available benchmarks and renders the combobox.
 * Following App Router Manifesto:
 * - Async server component for data fetching
 * - Passes data to client component as props
 */
export async function BenchmarkSelector({ selectedId }: BenchmarkSelectorProps) {
    const benchmarks = await getBenchmarkSets()

    if (benchmarks.length === 0) {
        return (
            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
                <p>No benchmarks available.</p>
                <p className="mt-2 text-sm">Create a benchmark to see leaderboard data.</p>
            </div>
        )
    }

    // Transform to simpler format for combobox
    const benchmarkOptions = benchmarks.map((b) => ({
        id: b.id,
        name: b.name,
    }))

    return (
        <div className="flex items-center gap-4">
            <label htmlFor="benchmark-select" className="text-sm font-medium">
                Select Benchmark:
            </label>
            <BenchmarkCombobox benchmarks={benchmarkOptions} selectedId={selectedId} />
        </div>
    )
}
