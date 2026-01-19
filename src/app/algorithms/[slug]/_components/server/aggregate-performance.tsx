import Link from 'next/link'

import type { AlgorithmHighlightMetric } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AggregatePerformanceProps {
    metrics: AlgorithmHighlightMetric[]
}

/**
 * Server component displaying the best performance metrics for an algorithm.
 * Shows Top-1 and Top-10 accuracy across highlight benchmarks.
 */
export function AggregatePerformance({ metrics }: AggregatePerformanceProps) {
    if (metrics.length === 0) {
        return null // No metrics available, don't render anything
    }

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Best Performance</h2>
            <p className="text-muted-foreground text-sm">
                Current state-of-the-art achieved by any version of this algorithm.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {metrics.map((metric) => (
                    <MetricCard key={`${metric.benchmarkId}:${metric.metricName}`} metric={metric} />
                ))}
            </div>
        </div>
    )
}

function MetricCard({ metric }: { metric: AlgorithmHighlightMetric }) {
    const percentage = (metric.value * 100).toFixed(1)
    const ciLower = (metric.ciLower * 100).toFixed(1)
    const ciUpper = (metric.ciUpper * 100).toFixed(1)

    return (
        <Card variant="bordered">
            <CardHeader>
                <CardDescription>{metric.benchmarkName}</CardDescription>
                <div>
                    <CardTitle className="text-2xl tabular-nums">{percentage}%</CardTitle>
                    <p className="text-muted-foreground text-xs tabular-nums">
                        95% CI: [{ciLower}%, {ciUpper}%]
                    </p>
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground text-sm">
                    {metric.metricName} Accuracy achieved by{' '}
                    <Link
                        href={`/models/${metric.modelInstanceSlug}`}
                        className="text-primary hover:underline"
                        prefetch={true}
                    >
                        {metric.modelInstanceName} ({metric.version})
                    </Link>
                </p>
            </CardContent>
        </Card>
    )
}
