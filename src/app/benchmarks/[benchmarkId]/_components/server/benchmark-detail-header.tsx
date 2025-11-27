import { notFound } from 'next/navigation'

import * as benchmarkService from '@/lib/services/benchmark.service'
import { Badge } from '@/components/ui/badge'

/**
 * Server component that fetches and displays benchmark header information.
 * Handles 404 if benchmark not found. Allows page to remain synchronous.
 */
export async function BenchmarkDetailHeader({ benchmarkId }: { benchmarkId: string }) {
    let benchmark
    try {
        benchmark = await benchmarkService.getBenchmarkById(benchmarkId)
    } catch {
        notFound()
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{benchmark.name}</h1>
                <Badge variant="secondary">{benchmark.targetCount.toLocaleString()} targets</Badge>
                {benchmark.stockName && <Badge variant="outline">Stock: {benchmark.stockName}</Badge>}
            </div>
            {benchmark.description && <p className="text-muted-foreground">{benchmark.description}</p>}
        </div>
    )
}
