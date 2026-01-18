import { AlertCircle } from 'lucide-react'

import type { RunStatistics } from '@/types'
import { MetricCell, MetricsViewToggle } from '@/components/metrics'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type RunStatisticsSummaryProps = {
    dataPromise: Promise<RunStatistics | null>
    stockId?: string
}

export async function RunStatisticsSummary({ dataPromise, stockId }: RunStatisticsSummaryProps) {
    if (!stockId) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Select a stock to view statistics for this run.</AlertDescription>
            </Alert>
        )
    }

    const statistics = await dataPromise

    if (!statistics) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    No statistics available for this stock. Run the scoring pipeline to generate metrics.
                </AlertDescription>
            </Alert>
        )
    }

    const parsedStats = statistics.statistics
    if (!parsedStats) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Could not parse statistics data for this run.</AlertDescription>
            </Alert>
        )
    }

    const solvability = parsedStats.solvability.overall
    const hasTopK = parsedStats.topKAccuracy && Object.keys(parsedStats.topKAccuracy).length > 0

    const metricsColumns = [{ name: 'Solvability', metric: solvability }]
    if (hasTopK && parsedStats.topKAccuracy) {
        const topKKeys = Object.keys(parsedStats.topKAccuracy).sort((a, b) => {
            const aNum = parseInt(a.replace(/^\D+/, ''))
            const bNum = parseInt(b.replace(/^\D+/, ''))
            return aNum - bNum
        })
        for (const key of topKKeys) {
            const displayName = key.startsWith('Top-') ? key : `Top-${key}`
            metricsColumns.push({ name: displayName, metric: parsedStats.topKAccuracy[key].overall })
        }
    }

    return (
        <Card variant="bordered">
            <CardHeader>
                <CardTitle>Overall Metrics</CardTitle>
                <CardDescription>
                    Performance metrics across all targets in the benchmark. Hover over values to see 95% confidence
                    intervals.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <MetricsViewToggle
                    metrics={metricsColumns}
                    nSamples={solvability.nSamples}
                    MetricCellComponent={MetricCell}
                />
            </CardContent>
        </Card>
    )
}
