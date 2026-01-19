import type { BenchmarkListItem, BenchmarkSeries } from '@/types'
import { BenchmarkSeriesBadge } from '@/components/badges/benchmark-series'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { BenchmarkCombobox } from '../client/benchmark-combobox'

type BenchmarkLeaderboardHeaderProps = {
    benchmark: BenchmarkListItem // receives the full object
    benchmarks: Array<{ id: string; name: string; series: BenchmarkSeries }> // receives the list for the combobox
}

/**
 * [REFACTORED] Server component that displays benchmark leaderboard header information.
 * This is now a "dumb" component that receives all its data via props.
 */
export function BenchmarkLeaderboardHeader({ benchmark, benchmarks }: BenchmarkLeaderboardHeaderProps) {
    return (
        <Card variant="bordered">
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <CardTitle className="text-2xl">{benchmark.name}</CardTitle>
                            <BenchmarkSeriesBadge series={benchmark.series} badgeStyle="soft" />
                        </div>
                        {benchmark.description && <CardDescription>{benchmark.description}</CardDescription>}
                    </div>
                    <div className="flex items-center gap-2">
                        <label htmlFor="benchmark-select" className="text-muted-foreground text-sm font-medium">
                            Benchmark:
                        </label>
                        <BenchmarkCombobox benchmarks={benchmarks} selectedId={benchmark.id} />
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
