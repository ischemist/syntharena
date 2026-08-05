import type { StratifiedMetric } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { StratifiedMetricTable } from '../client/stratified-metric-table'

type StratifiedMetricCardProps = {
    metricName: string
    metricsMap: Map<
        string,
        {
            tier0Validity: StratifiedMetric
            solv0: StratifiedMetric
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
    const strata = new Set<string>()
    modelsArray.forEach(([, metrics]) => {
        const stratifiedMetric =
            metricName === 'Tier-0 valid'
                ? metrics.tier0Validity
                : metricName.startsWith('Solv-0[')
                  ? metrics.solv0
                  : metrics.topKAccuracy?.[metricName]

        if (stratifiedMetric) {
            Object.keys(stratifiedMetric.byStratum).forEach((stratum) => strata.add(stratum))
        }
    })

    const sortedStrata = Array.from(strata).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

    if (sortedStrata.length === 0) {
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
                    strata={sortedStrata}
                    showTitle={false}
                />
            </CardContent>
        </Card>
    )
}
