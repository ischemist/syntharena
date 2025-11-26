import type { MetricResult, StratifiedMetric } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type StratifiedMetricsTableProps = {
    metricsMap: Map<
        string,
        {
            solvability: StratifiedMetric
            topKAccuracy?: Record<string, StratifiedMetric>
        }
    >
    MetricCellComponent: React.ComponentType<{ metric: MetricResult; showBadge?: boolean }>
}

/**
 * Shared component for displaying stratified metrics (broken down by route length).
 * Used by both runs page and leaderboard.
 *
 * Server component that displays stratified metrics tables.
 * Shows metrics broken down by route length for easy comparison.
 */
export function StratifiedMetricsTable({ metricsMap, MetricCellComponent }: StratifiedMetricsTableProps) {
    if (metricsMap.size === 0) {
        return null
    }

    // Convert map to array for rendering
    const modelsArray = Array.from(metricsMap.entries())

    // Get all route lengths present in the data
    const routeLengths = new Set<number>()
    modelsArray.forEach(([_modelName, metrics]) => {
        Object.keys(metrics.solvability.byGroup).forEach((length) => {
            routeLengths.add(parseInt(length))
        })
        if (metrics.topKAccuracy) {
            Object.values(metrics.topKAccuracy).forEach((topKMetric) => {
                Object.keys(topKMetric.byGroup).forEach((length) => {
                    routeLengths.add(parseInt(length))
                })
            })
        }
    })

    const sortedLengths = Array.from(routeLengths).sort((a, b) => a - b)

    if (sortedLengths.length === 0) {
        return null
    }

    // Get list of available Top-K metrics
    const topKMetricNames = new Set<string>()
    modelsArray.forEach(([_modelName, metrics]) => {
        if (metrics.topKAccuracy) {
            Object.keys(metrics.topKAccuracy).forEach((metricName) => {
                topKMetricNames.add(metricName)
            })
        }
    })
    const sortedTopKNames = Array.from(topKMetricNames).sort((a, b) => {
        const aNum = parseInt(a.replace(/^\D+/, ''))
        const bNum = parseInt(b.replace(/^\D+/, ''))
        return aNum - bNum
    })

    return (
        <div className="space-y-6">
            {/* Solvability by Route Length */}
            <Card>
                <CardHeader>
                    <CardTitle>Solvability by Route Length</CardTitle>
                    <CardDescription>Performance breakdown by ground truth route length</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Model</TableHead>
                                {sortedLengths.map((length) => (
                                    <TableHead key={length} className="min-w-[220px] text-right">
                                        Length {length}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {modelsArray.map(([modelName, metrics]) => (
                                <TableRow key={modelName}>
                                    <TableCell className="font-medium">{modelName}</TableCell>
                                    {sortedLengths.map((length) => {
                                        const metric = metrics.solvability.byGroup[length]
                                        return (
                                            <TableCell key={length} className="text-right">
                                                {metric ? <MetricCellComponent metric={metric} showBadge /> : '-'}
                                            </TableCell>
                                        )
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Top-K Accuracy by Route Length */}
            {sortedTopKNames.map((topKMetricName) => (
                <Card key={topKMetricName}>
                    <CardHeader>
                        <CardTitle>{topKMetricName} Accuracy by Route Length</CardTitle>
                        <CardDescription>
                            Ground truth match rate within top {topKMetricName.replace(/^\D+/, '')} predictions
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Model</TableHead>
                                    {sortedLengths.map((length) => (
                                        <TableHead key={length} className="min-w-[220px] text-right">
                                            Length {length}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {modelsArray.map(([modelName, metrics]) => {
                                    const topKMetric = metrics.topKAccuracy?.[topKMetricName]
                                    if (!topKMetric) return null

                                    return (
                                        <TableRow key={modelName}>
                                            <TableCell className="font-medium">{modelName}</TableCell>
                                            {sortedLengths.map((length) => {
                                                const metric = topKMetric.byGroup[length]
                                                return (
                                                    <TableCell key={length} className="text-right">
                                                        {metric ? (
                                                            <MetricCellComponent metric={metric} showBadge />
                                                        ) : (
                                                            '-'
                                                        )}
                                                    </TableCell>
                                                )
                                            })}
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
