import type { ModelInstanceExecutiveSummary } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ModelExecutiveSummaryProps {
    summary: ModelInstanceExecutiveSummary
}

/**
 * Server component displaying executive summary statistics for a model instance.
 * Shows average cost/duration per compound, run count, benchmark count, and best Top-10 accuracy.
 */
export function ModelExecutiveSummary({ summary }: ModelExecutiveSummaryProps) {
    if (summary.totalRuns === 0) {
        return null // No runs available, don't render anything
    }

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Executive Summary</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard
                    title="Avg Cost / 1M Compounds"
                    value={
                        summary.avgCostPerCompound != null
                            ? `$${(summary.avgCostPerCompound * 1_000_000).toLocaleString('en-US', {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 0,
                              })}`
                            : '—'
                    }
                    description="Estimated cost to process 1 million compounds"
                />
                <StatCard
                    title="Avg Duration/Compound"
                    value={
                        summary.avgDurationPerCompound != null ? `${summary.avgDurationPerCompound.toFixed(1)}s` : '—'
                    }
                    description="Average wall time per target"
                />
                <StatCard
                    title="Total Runs"
                    value={summary.totalRuns.toString()}
                    description="Number of prediction runs"
                />
                <StatCard
                    title="Benchmarks Evaluated"
                    value={summary.benchmarkCount.toString()}
                    description="Distinct benchmarks tested"
                />
                {summary.bestTop10Accuracy && (
                    <StatCard
                        title="Best Top-10 Accuracy"
                        value={`${(summary.bestTop10Accuracy.value * 100).toFixed(1)}%`}
                        description={`95% CI: [${(summary.bestTop10Accuracy.ciLower * 100).toFixed(1)}%, ${(summary.bestTop10Accuracy.ciUpper * 100).toFixed(1)}%]`}
                    />
                )}
            </div>
        </div>
    )
}

function StatCard({ title, value, description }: { title: string; value: string; description: string }) {
    return (
        <Card variant="bordered">
            <CardHeader>
                <CardDescription>{title}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground text-xs">{description}</p>
            </CardContent>
        </Card>
    )
}
