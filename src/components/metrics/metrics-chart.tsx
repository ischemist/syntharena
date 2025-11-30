'use client'

import { Bar, BarChart, CartesianGrid, Cell, ErrorBar, XAxis, YAxis } from 'recharts'

import type { MetricResult } from '@/types'
import { filterPlateauMetrics } from '@/lib/utils'
import { getMetricColors } from '@/components/theme/chart-palette'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

type MetricsChartProps = {
    metrics: Array<{
        name: string
        metric: MetricResult
    }>
}

/**
 * Bar chart visualization of overall metrics with error bars.
 * Displays percentage values with 95% confidence interval error bars.
 *
 * Client component that uses recharts for interactive visualization.
 */
export function MetricsChart({ metrics }: MetricsChartProps) {
    // Filter out duplicate plateau values in Top-k metrics
    const filteredMetrics = filterPlateauMetrics(metrics)

    // Transform metrics data for recharts with semantic colors
    const chartData = filteredMetrics.map((m, idx) => {
        const value = m.metric.value * 100 // Convert to percentage
        const ciLower = m.metric.ciLower * 100
        const ciUpper = m.metric.ciUpper * 100
        const colors = getMetricColors(m.name, idx)
        return {
            name: m.name,
            value,
            // Store absolute CI bounds for tooltip display
            ciLower,
            ciUpper,
            // Compute deviations for error bars (recharts expects deviation from value)
            errorLower: value - ciLower,
            errorUpper: ciUpper - value,
            nSamples: m.metric.nSamples,
            reliability: m.metric.reliability,
            // Store colors for this metric
            barColor: colors.bar,
            errorBarColor: colors.errorBar,
        }
    })

    // Chart configuration for theming
    const chartConfig = {
        value: {
            label: 'Value',
        },
    }

    return (
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
            <BarChart
                data={chartData}
                margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 20,
                }}
            >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" stroke="hsl(var(--foreground))" fontSize={12} tickLine={false} axisLine={false} />
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
                    {chartData.map((entry, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={entry.barColor}
                            opacity={entry.reliability.code === 'OK' ? 1 : 0.5}
                        />
                    ))}
                    {/* ErrorBar with array [lower, upper] for asymmetric error bars */}
                    <ErrorBar
                        dataKey={(entry) => [entry.errorLower, entry.errorUpper]}
                        width={6}
                        strokeWidth={2.5}
                        stroke="currentColor"
                        opacity={0.8}
                    />
                </Bar>
            </BarChart>
        </ChartContainer>
    )
}
