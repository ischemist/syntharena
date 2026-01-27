import type { LeaderboardEntry } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { ParetoChartClientWrapper } from '../client/pareto-chart.client'

type BenchmarkParetoDisplayProps = {
    entries: LeaderboardEntry[]
    availableTopKMetrics: string[]
}

/**
 * server component wrapper for the pareto frontier chart.
 * defines the card structure and passes data to the client component.
 */
export function BenchmarkParetoDisplay({ entries, availableTopKMetrics }: BenchmarkParetoDisplayProps) {
    // don't render if there's no data to make a meaningful plot.
    const hasPlottableData = entries.some(
        (e) => (e.totalWallTime != null || e.totalCost != null) && e.metrics.topKAccuracy
    )

    if (!hasPlottableData || availableTopKMetrics.length === 0) {
        return null
    }

    return (
        <Card variant="bordered">
            <CardHeader>
                <CardTitle>Efficiency Frontier</CardTitle>
                <CardDescription>
                    Visualizing the trade-off between performance and computational resources. Ideal models are in the
                    top-left.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ParetoChartClientWrapper entries={entries} availableTopKMetrics={availableTopKMetrics} />
            </CardContent>
        </Card>
    )
}
