import type { BenchmarkListItem } from '@/types'
import { Badge } from '@/components/ui/badge'

/**
 * Synchronous component that displays benchmark header information from a pre-fetched DTO.
 */
export function BenchmarkDetailHeader({ benchmark }: { benchmark: BenchmarkListItem }) {
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{benchmark.name}</h1>
                <Badge variant="secondary">{benchmark.targetCount.toLocaleString()} targets</Badge>
                <Badge variant="outline">Stock: {benchmark.stock.name}</Badge>
            </div>
            {benchmark.description && <p className="text-muted-foreground">{benchmark.description}</p>}
        </div>
    )
}
