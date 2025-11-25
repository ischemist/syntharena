import Link from 'next/link'

import * as benchmarkService from '@/lib/services/benchmark.service'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Server component that displays all available benchmarks with their target counts.
 * Each benchmark card is clickable and navigates to the benchmark detail page.
 */
export async function BenchmarkList() {
    const benchmarks = await benchmarkService.getBenchmarkSets()

    if (benchmarks.length === 0) {
        return (
            <Card>
                <CardContent className="text-muted-foreground py-8 text-center">
                    No benchmarks available. Load a benchmark using the CLI script.
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            {benchmarks.map((benchmark) => (
                <Link key={benchmark.id} href={`/benchmarks/${benchmark.id}`} prefetch={true}>
                    <Card className="hover:bg-accent my-4 transition-colors">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>{benchmark.name}</CardTitle>
                                <div className="flex gap-2">
                                    <Badge variant="secondary">{benchmark.targetCount.toLocaleString()} targets</Badge>
                                    {benchmark.stockName && (
                                        <Badge variant="outline">Stock: {benchmark.stockName}</Badge>
                                    )}
                                </div>
                            </div>
                            {benchmark.description && <CardDescription>{benchmark.description}</CardDescription>}
                        </CardHeader>
                    </Card>
                </Link>
            ))}
        </div>
    )
}
