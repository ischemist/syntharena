import type { StratifiedMetric } from '@/types'
import { MetricCell } from '@/components/metrics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
 * Card title format: "{metricName} - {stockName}"
 * Shows performance breakdown across route lengths for all models.
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
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Model</TableHead>
                                {sortedLengths.map((length, idx) => (
                                    <TableHead
                                        key={length}
                                        className={
                                            idx === sortedLengths.length - 1
                                                ? 'min-w-[220px] pr-24 text-right'
                                                : 'min-w-[220px] text-right'
                                        }
                                    >
                                        Length {length}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {modelsArray.map(([modelName, metrics]) => {
                                const stratifiedMetric =
                                    metricName === 'Solvability'
                                        ? metrics.solvability
                                        : metrics.topKAccuracy?.[metricName]

                                if (!stratifiedMetric) return null

                                return (
                                    <TableRow key={modelName}>
                                        <TableCell className="font-medium">{modelName}</TableCell>
                                        {sortedLengths.map((length, idx) => {
                                            const metric = stratifiedMetric.byGroup[length]
                                            const isLastColumn = idx === sortedLengths.length - 1
                                            return (
                                                <TableCell
                                                    key={length}
                                                    className={
                                                        isLastColumn
                                                            ? 'pr-24 text-right' // Extra padding right for last column upper CI + badge
                                                            : 'text-right'
                                                    }
                                                >
                                                    {metric ? <MetricCell metric={metric} showBadge /> : '-'}
                                                </TableCell>
                                            )
                                        })}
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}
