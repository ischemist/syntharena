'use client'

import { useState } from 'react'
import { BarChart3, Table2 } from 'lucide-react'

import type { LeaderboardEntry } from '@/types'
import { MetricsChart } from '@/components/metrics'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { MetricCell } from '../../../runs/[runId]/_components/client/metric-cell'

type BenchmarkMetricsDisplayProps = {
    entries: LeaderboardEntry[]
    topKMetricNames: string[]
}

/**
 * Client component for displaying benchmark metrics with table/chart toggle.
 * Uses local state for view preference (ephemeral UI state).
 *
 * Following App Router Manifesto:
 * - Client component for interactive UI (useState, onClick)
 * - Receives data as props from server parent
 * - Local state only for non-canonical UI state
 */
export function BenchmarkMetricsDisplay({ entries, topKMetricNames }: BenchmarkMetricsDisplayProps) {
    const [view, setView] = useState<'table' | 'chart'>('table')

    // For chart view, we need to transform data to metrics format
    // We'll show one chart per model (or aggregate if needed)
    // For now, let's show table by default and allow chart toggle per model row

    const hasTopKMetrics = topKMetricNames.length > 0

    return (
        <div>
            {/* Toggle buttons */}
            <div className="mb-4 flex justify-end gap-2">
                <Button
                    variant={view === 'table' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setView('table')}
                    className="gap-2"
                >
                    <Table2 className="h-4 w-4" />
                    Table
                </Button>
                <Button
                    variant={view === 'chart' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setView('chart')}
                    className="gap-2"
                >
                    <BarChart3 className="h-4 w-4" />
                    Chart
                </Button>
            </div>

            {/* Content area */}
            {view === 'table' ? (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Model</TableHead>
                                <TableHead>Stock</TableHead>
                                <TableHead className="min-w-[220px] text-right">Solvability</TableHead>
                                {topKMetricNames.map((metricName) => (
                                    <TableHead key={metricName} className="min-w-[220px] text-right">
                                        {metricName}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries.map((entry) => {
                                const key = `${entry.modelName}-${entry.stockName}`
                                return (
                                    <TableRow key={key}>
                                        <TableCell className="font-medium">{entry.modelName}</TableCell>
                                        <TableCell>{entry.stockName}</TableCell>
                                        <TableCell className="text-right">
                                            <MetricCell metric={entry.metrics.solvability} showBadge />
                                        </TableCell>
                                        {topKMetricNames.map((metricName) => {
                                            const metric = entry.metrics.topKAccuracy?.[metricName]
                                            return (
                                                <TableCell key={metricName} className="text-right">
                                                    {metric ? <MetricCell metric={metric} showBadge /> : '-'}
                                                </TableCell>
                                            )
                                        })}
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>

                    {!hasTopKMetrics && (
                        <p className="text-muted-foreground mt-4 text-sm">
                            * Top-K accuracy metrics are only available for benchmarks with ground truth routes
                        </p>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Chart view: Show one chart per model-stock combination */}
                    {entries.map((entry) => {
                        const key = `${entry.modelName}-${entry.stockName}`

                        // Build metrics array for this entry
                        const metricsArray: Array<{
                            name: string
                            metric: typeof entry.metrics.solvability
                        }> = [{ name: 'Solvability', metric: entry.metrics.solvability }]

                        if (entry.metrics.topKAccuracy) {
                            topKMetricNames.forEach((metricName) => {
                                const metric = entry.metrics.topKAccuracy?.[metricName]
                                if (metric) {
                                    metricsArray.push({ name: metricName, metric })
                                }
                            })
                        }

                        return (
                            <div key={key}>
                                <h4 className="mb-2 text-sm font-medium">
                                    {entry.modelName} - {entry.stockName}
                                </h4>
                                <MetricsChart metrics={metricsArray} />
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
