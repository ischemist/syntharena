import { getBenchmarkById } from '@/lib/services/view/benchmark.view'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { BenchmarkCombobox } from '../client/benchmark-combobox'

type BenchmarkLeaderboardHeaderProps = {
    benchmarkId: string
    benchmarks: Array<{ id: string; name: string }>
}

/**
 * Server component that displays benchmark leaderboard header information.
 * Shows the benchmark selector and metadata in a bordered card.
 * Layout inspired by run-detail-header and target-header components.
 */
export async function BenchmarkLeaderboardHeader({ benchmarkId, benchmarks }: BenchmarkLeaderboardHeaderProps) {
    const benchmark = await getBenchmarkById(benchmarkId)

    return (
        <Card variant="bordered">
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <CardTitle className="text-2xl">{benchmark.name}</CardTitle>
                        {benchmark.description && <CardDescription>{benchmark.description}</CardDescription>}
                    </div>
                    <div className="flex items-center gap-2">
                        <label htmlFor="benchmark-select" className="text-muted-foreground text-sm font-medium">
                            Benchmark:
                        </label>
                        <BenchmarkCombobox benchmarks={benchmarks} selectedId={benchmarkId} />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                    <div className="text-muted-foreground text-sm">Total Targets</div>
                    <div className="text-lg font-medium">{benchmark.targetCount}</div>
                </div>
                <div>
                    <div className="text-muted-foreground text-sm">Stock</div>
                    <div className="text-lg font-medium">{benchmark.stock.name}</div>
                </div>
                <div>
                    <div className="text-muted-foreground text-sm">Acceptable Routes</div>
                    <Badge variant="secondary" className="mt-1">
                        {benchmark.hasAcceptableRoutes ? 'Available' : 'Not Available'}
                    </Badge>
                </div>
            </CardContent>
        </Card>
    )
}
