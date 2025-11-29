import type { StratifiedMetric } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { StratifiedMetricTable } from '../client/stratified-metric-table'

type StratifiedMetricCardProps = {
    metricName: string
    metricsMap: Map<
        string,
        {
            solvability: StratifiedMetric
            topKAccuracy?: Record<string, StratifiedMetric>
        }
    >
}

/**
 * Server component that displays a single stratified metric (by route length) in a bordered card.
 * Card title shows the metric name. Table content is delegated to client component for sorting.
 * Shows performance breakdown across route lengths for all models.
 *
 * Following App Router Manifesto:
 * - Server component defines structure
 * - Client component (StratifiedMetricTable) handles interactive sorting
 */
export function StratifiedMetricCard({ metricName, metricsMap }: StratifiedMetricCardProps) {
    // Convert map to array for rendering
    const modelsArray = Array.from(metricsMap.entries())

    if (modelsArray.length === 0) {
        return null
    }

    // Get all route lengths present in the data for this metric
    const routeLengths = new Set<number>()
    modelsArray.forEach(([, metrics]) => {
        const stratifiedMetric = metricName === 'Solvability' ? metrics.solvability : metrics.topKAccuracy?.[metricName]

        if (stratifiedMetric) {
            Object.keys(stratifiedMetric.byGroup).forEach((length) => {
                routeLengths.add(parseInt(length))
            })
        }
    })

    const sortedLengths = Array.from(routeLengths).sort((a, b) => a - b)

    if (sortedLengths.length === 0) {
        return null
    }

    return (
        <Card variant="bordered">
            <CardHeader>
                <CardTitle>{metricName}</CardTitle>
            </CardHeader>
            <CardContent>
                <StratifiedMetricTable
                    metricName={metricName}
                    metricsMap={metricsMap}
                    routeLengths={sortedLengths}
                    showTitle={false}
                />
            </CardContent>
        </Card>
    )
}
