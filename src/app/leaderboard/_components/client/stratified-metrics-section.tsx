'use client'

import type { MetricResult, StratifiedMetric } from '@/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { useSelectedTopK } from './page-level-top-k-selector'

type StratifiedMetricsSectionProps = {
    metricsMap: Map<
        string,
        {
            solvability: StratifiedMetric
            topKAccuracy?: Record<string, StratifiedMetric>
        }
    >
    MetricCell: React.ComponentType<{ metric: MetricResult; showBadge?: boolean }>
}

/**
 * Client component for displaying stratified metrics (broken down by route length).
 * Shows all stratified metrics in tables within the same card section.
 */
export function StratifiedMetricsSection({ metricsMap, MetricCell }: StratifiedMetricsSectionProps) {
    // Get selected Top-K from context
    const selectedTopK = useSelectedTopK()
    if (metricsMap.size === 0) {
        return null
    }

    // Convert map to array for rendering
    const modelsArray = Array.from(metricsMap.entries())

    // Get all route lengths present in the data
    const routeLengths = new Set<number>()
    modelsArray.forEach(([, metrics]) => {
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

    // Filter Top-K metrics to only show selected ones
    const displayedTopK = selectedTopK.filter((metricName) => {
        // Verify at least one model has this metric
        return modelsArray.some(([, metrics]) => metrics.topKAccuracy?.[metricName])
    })

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold">Stratified Metrics</h3>

            {/* Solvability by Route Length */}
            <div>
                <h4 className="text-muted-foreground mb-3 text-sm font-medium">Solvability by Route Length</h4>
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
                            {modelsArray.map(([modelName, metrics]) => (
                                <TableRow key={modelName}>
                                    <TableCell className="font-medium">{modelName}</TableCell>
                                    {sortedLengths.map((length, idx) => {
                                        const metric = metrics.solvability.byGroup[length]
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
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Top-K Accuracy by Route Length */}
            {displayedTopK.map((topKMetricName) => (
                <div key={topKMetricName}>
                    <h4 className="text-muted-foreground mb-3 text-sm font-medium">
                        {topKMetricName} Accuracy by Route Length
                    </h4>
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
                                    const topKMetric = metrics.topKAccuracy?.[topKMetricName]
                                    if (!topKMetric) return null

                                    return (
                                        <TableRow key={modelName}>
                                            <TableCell className="font-medium">{modelName}</TableCell>
                                            {sortedLengths.map((length, idx) => {
                                                const metric = topKMetric.byGroup[length]
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
                </div>
            ))}
        </div>
    )
}
