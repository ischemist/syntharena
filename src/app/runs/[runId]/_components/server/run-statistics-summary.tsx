import { AlertCircle } from 'lucide-react'

import type { RunStatistics } from '@/types'
import { MetricCell, MetricsViewToggle } from '@/components/metrics'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type RunStatisticsSummaryProps = {
    dataPromise: Promise<RunStatistics | null>
    evaluationId?: string
}

export async function RunStatisticsSummary({ dataPromise, evaluationId }: RunStatisticsSummaryProps) {
    if (!evaluationId) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Select an evaluation to view statistics for this run.</AlertDescription>
            </Alert>
        )
    }

    const statistics = await dataPromise

    if (!statistics) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    No statistics are available for this evaluation. Run the scoring pipeline to generate metrics.
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

    const tier0 = parsedStats.tier0Validity?.overall
    const solv0 = parsedStats.solv0?.overall
    if (!tier0 || !solv0) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Tier-0 or Solv-0 is unavailable for this evaluation.</AlertDescription>
            </Alert>
        )
    }
    const hasTopK = Object.keys(parsedStats.topKAccuracy).length > 0

    const metricsColumns = [
        { name: 'Tier-0 valid', metric: tier0 },
        { name: `Solv-0[${parsedStats.metricLabel}]`, metric: solv0 },
    ]
    if (hasTopK) {
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
                    nSamples={tier0.nSamples}
                    MetricCellComponent={MetricCell}
                />
            </CardContent>
        </Card>
    )
}
