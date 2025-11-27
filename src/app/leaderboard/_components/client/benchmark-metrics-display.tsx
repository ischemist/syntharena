'use client'

import { useState } from 'react'
import { BarChart3, Table2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ErrorBar, XAxis, YAxis } from 'recharts'

import type { LeaderboardEntry } from '@/types'
import { MetricCell } from '@/components/metrics'
import { chartColors } from '@/components/theme/chart-palette'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type BenchmarkMetricsDisplayProps = {
    entries: LeaderboardEntry[]
    topKMetricNames: string[]
    selectedTopK: string[]
}

/**
 * Client component for displaying benchmark metrics with table/chart toggle.
 * Uses local state for view preference (ephemeral UI state).
 *
 * Following App Router Manifesto:
 * - Client component for interactive UI (useState, onClick)
 * - Receives data and selectedTopK as props from parent
 * - Local state only for non-canonical UI state (view toggle)
 */
export function BenchmarkMetricsDisplay({ entries, topKMetricNames, selectedTopK }: BenchmarkMetricsDisplayProps) {
    const [view, setView] = useState<'table' | 'chart'>('table')

    const hasTopKMetrics = topKMetricNames.length > 0

    // Determine which Top-K metrics to show in the table/chart
    const displayedTopK = hasTopKMetrics ? selectedTopK : []

    return (
        <div>
            {/* View toggle buttons */}
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
                                <TableHead
                                    className={
                                        displayedTopK.length === 0
                                            ? 'min-w-[220px] pr-24 text-right'
                                            : 'min-w-[220px] text-right'
                                    }
                                >
                                    Solvability
                                </TableHead>
                                {displayedTopK.map((metricName, idx) => (
                                    <TableHead
                                        key={metricName}
                                        className={
                                            idx === displayedTopK.length - 1
                                                ? 'min-w-[220px] pr-24 text-right'
                                                : 'min-w-[220px] text-right'
                                        }
                                    >
                                        {metricName}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries.map((entry) => {
                                const key = `${entry.modelName}-${entry.stockName}`
                                const isLastColumnSolvability = displayedTopK.length === 0
                                return (
                                    <TableRow key={key}>
                                        <TableCell className="font-medium">{entry.modelName}</TableCell>
                                        <TableCell
                                            className={
                                                isLastColumnSolvability
                                                    ? 'pr-24 text-right' // Extra padding right for last column upper CI + badge
                                                    : 'text-right'
                                            }
                                        >
                                            <MetricCell metric={entry.metrics.solvability} showBadge />
                                        </TableCell>
                                        {displayedTopK.map((metricName, idx) => {
                                            const metric = entry.metrics.topKAccuracy?.[metricName]
                                            const isLastColumn = idx === displayedTopK.length - 1
                                            return (
                                                <TableCell
                                                    key={metricName}
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

                    {!hasTopKMetrics && (
                        <p className="text-muted-foreground mt-4 text-sm">
                            * Top-K accuracy metrics are only available for benchmarks with ground truth routes
                        </p>
                    )}
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Chart view: Show one chart per metric comparing all models */}
                    <ModelComparisonChart metricName="Solvability" entries={entries} />

                    {displayedTopK.map((metricName) => (
                        <ModelComparisonChart key={metricName} metricName={metricName} entries={entries} />
                    ))}
                </div>
            )}
        </div>
    )
}

/**
 * Chart component that compares all models for a single metric.
 * X-axis shows model names, Y-axis shows metric value.
 */
function ModelComparisonChart({ metricName, entries }: { metricName: string; entries: LeaderboardEntry[] }) {
    // Transform data: one data point per model
    const chartData = entries
        .map((entry) => {
            const metric =
                metricName === 'Solvability' ? entry.metrics.solvability : entry.metrics.topKAccuracy?.[metricName]

            if (!metric) return null

            const value = metric.value * 100
            const ciLower = metric.ciLower * 100
            const ciUpper = metric.ciUpper * 100

            return {
                model: entry.modelName,
                value,
                ciLower,
                ciUpper,
                errorLower: value - ciLower,
                errorUpper: ciUpper - value,
                nSamples: metric.nSamples,
                reliability: metric.reliability,
            }
        })
        .filter((d): d is NonNullable<typeof d> => d !== null)

    if (chartData.length === 0) {
        return null
    }

    const chartConfig = {
        value: {
            label: metricName,
            color: chartColors.primary,
        },
    }

    return (
        <div>
            <h4 className="mb-4 text-sm font-semibold">{metricName} Comparison</h4>
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
                <BarChart
                    data={chartData}
                    margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 80,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                        dataKey="model"
                        stroke="hsl(var(--foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        angle={-45}
                        textAnchor="end"
                        height={100}
                    />
                    <YAxis
                        stroke="hsl(var(--foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}%`}
                        domain={[0, 100]}
                    />
                    <ChartTooltip
                        content={
                            <ChartTooltipContent
                                className="w-[220px]"
                                formatter={(value, _name, item) => (
                                    <>
                                        <div className="flex w-full items-center justify-between gap-2">
                                            <span className="text-muted-foreground">Value:</span>
                                            <span className="font-mono font-medium">
                                                {typeof value === 'number' ? value.toFixed(1) : value}%
                                            </span>
                                        </div>
                                        <div className="flex w-full items-center justify-between gap-2">
                                            <span className="text-muted-foreground">95% CI:</span>
                                            <span className="font-mono text-xs">
                                                [{item.payload.ciLower.toFixed(1)}, {item.payload.ciUpper.toFixed(1)}]
                                            </span>
                                        </div>
                                        <div className="flex w-full items-center justify-between gap-2">
                                            <span className="text-muted-foreground">n:</span>
                                            <span className="font-mono">{item.payload.nSamples}</span>
                                        </div>
                                        {item.payload.reliability.code !== 'OK' && (
                                            <div className="border-destructive/50 bg-destructive/10 mt-2 rounded border px-2 py-1 text-xs">
                                                {item.payload.reliability.message}
                                            </div>
                                        )}
                                    </>
                                )}
                                labelFormatter={(label) => label}
                            />
                        }
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        <ErrorBar
                            dataKey={(entry) => [entry.errorLower, entry.errorUpper]}
                            width={6}
                            strokeWidth={2.5}
                            stroke={chartColors.primaryDark}
                        />
                        {chartData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.reliability.code === 'OK' ? chartColors.reliable : chartColors.unreliable}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ChartContainer>
        </div>
    )
}
