'use client'

import { Bar, BarChart, CartesianGrid, Cell, ErrorBar, XAxis, YAxis } from 'recharts'

import type { MetricResult } from '@/types'
import { chartColors } from '@/components/theme/chart-palette'
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
    // Transform metrics data for recharts
    const chartData = metrics.map((m) => {
        const value = m.metric.value * 100 // Convert to percentage
        const ciLower = m.metric.ciLower * 100
        const ciUpper = m.metric.ciUpper * 100
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
        }
    })

    // Chart configuration for theming
    const chartConfig = {
        value: {
            label: 'Value',
            color: chartColors.primary,
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
                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill={chartColors.primary}>
                    {/* ErrorBar with array [lower, upper] for asymmetric error bars */}
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
    )
}
