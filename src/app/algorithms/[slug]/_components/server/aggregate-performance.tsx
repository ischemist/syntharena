import Link from 'next/link'

import type { AlgorithmHighlightMetric } from '@/types'

interface AggregatePerformanceProps {
    metrics: AlgorithmHighlightMetric[]
}

function formatPercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`
}

function formatCI(lower: number, upper: number): string {
    return `[${(lower * 100).toFixed(0)}–${(upper * 100).toFixed(0)}%]`
}

/**
 * Server component displaying the best performance metrics for an algorithm.
 * Shows Top-1 and Top-10 accuracy across highlight benchmarks.
 */
export function AggregatePerformance({ metrics }: AggregatePerformanceProps) {
    if (metrics.length === 0) {
        return null // No metrics available, don't render anything
    }

    // Group metrics by metricName, preserving insertion order
    const grouped = metrics.reduce(
        (acc, metric) => {
            const key = metric.metricName
            if (!acc[key]) acc[key] = []
            acc[key].push(metric)
            return acc
        },
        {} as Record<string, AlgorithmHighlightMetric[]>
    )

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Best Performance</h2>
            <p className="text-muted-foreground text-sm">
                Current state-of-the-art achieved by any version of this algorithm.
            </p>
            <div className="flex flex-col gap-6 lg:flex-row lg:gap-12">
                {Object.entries(grouped).map(([metricName, items]) => (
                    <div key={metricName} className="space-y-2">
                        <h3 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                            {metricName}
                        </h3>
                        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                            {items.map((metric) => (
                                <div
                                    key={`${metric.benchmarkId}:${metric.metricName}`}
                                    className="flex items-baseline gap-2"
                                >
                                    <span className="text-foreground text-lg font-semibold tabular-nums">
                                        {formatPercent(metric.value)}
                                    </span>
                                    <span className="text-muted-foreground/50 text-xs tabular-nums">
                                        {formatCI(metric.ciLower, metric.ciUpper)}
                                    </span>
                                    <span className="text-muted-foreground text-sm">{metric.benchmarkName}</span>
                                    <Link
                                        href={`/models/${metric.modelInstanceSlug}`}
                                        className="text-muted-foreground/60 hover:text-foreground text-xs transition-colors"
                                        prefetch={true}
                                    >
                                        {metric.modelInstanceName}
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
