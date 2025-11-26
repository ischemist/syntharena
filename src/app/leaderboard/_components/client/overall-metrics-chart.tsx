'use client'

import { Bar, BarChart, CartesianGrid, Cell, ErrorBar, XAxis, YAxis } from 'recharts'

import type { LeaderboardEntry } from '@/types'
import { chartColors, getSeriesColors } from '@/components/theme/chart-palette'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

type OverallMetricsChartProps = {
    entries: LeaderboardEntry[]
}

/**
 * Bar chart visualization of overall metrics with error bars.
 * Displays percentage values with 95% confidence interval error bars.
 * Groups by model with different colors per model.
 *
 * Client component that uses recharts for interactive visualization.
 */
export function OverallMetricsChart({ entries }: OverallMetricsChartProps) {
    if (entries.length === 0) {
        return <div className="text-muted-foreground py-8 text-center">No data to display</div>
    }

    // Transform entries to chart data format
    // For simplicity, we'll show solvability metric (most common)
    const chartData = entries.map((entry, index) => {
        const solvability = entry.metrics.solvability
        const value = solvability.value * 100 // Convert to percentage
        const ciLower = solvability.ciLower * 100
        const ciUpper = solvability.ciUpper * 100

        return {
            name: entry.modelName,
            benchmark: entry.benchmarkName,
            stock: entry.stockName,
            value,
            ciLower,
            ciUpper,
            errorLower: value - ciLower,
            errorUpper: ciUpper - value,
            nSamples: solvability.nSamples,
            reliability: solvability.reliability,
            colorIndex: index,
        }
    })

    // Chart configuration for theming
    const chartConfig = {
        value: {
            label: 'Solvability',
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
                    bottom: 60,
                }}
            >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                    dataKey="name"
                    stroke="hsl(var(--foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                />
                <YAxis
                    stroke="hsl(var(--foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}%`}
                    domain={[0, 100]}
                    label={{ value: 'Solvability (%)', angle: -90, position: 'insideLeft' }}
                />
                <ChartTooltip
                    content={
                        <ChartTooltipContent
                            className="w-[240px]"
                            formatter={(value, _name, item) => (
                                <>
                                    <div className="flex w-full items-center justify-between gap-2">
                                        <span className="text-muted-foreground">Model:</span>
                                        <span className="font-medium">{item.payload.name}</span>
                                    </div>
                                    <div className="flex w-full items-center justify-between gap-2">
                                        <span className="text-muted-foreground">Benchmark:</span>
                                        <span className="text-xs">{item.payload.benchmark}</span>
                                    </div>
                                    <div className="flex w-full items-center justify-between gap-2">
                                        <span className="text-muted-foreground">Stock:</span>
                                        <span className="text-xs">{item.payload.stock}</span>
                                    </div>
                                    <div className="border-border my-2 border-t" />
                                    <div className="flex w-full items-center justify-between gap-2">
                                        <span className="text-muted-foreground">Solvability:</span>
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
                            labelFormatter={(label) => `Model: ${label}`}
                        />
                    }
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {/* ErrorBar with array [lower, upper] for asymmetric error bars */}
                    <ErrorBar dataKey={(entry) => [entry.errorLower, entry.errorUpper]} width={6} strokeWidth={2.5} />
                    {chartData.map((entry, index) => {
                        const colors = getSeriesColors(entry.colorIndex)
                        const fillColor = entry.reliability.code === 'OK' ? colors.bar : chartColors.unreliable
                        const strokeColor = entry.reliability.code === 'OK' ? colors.errorBar : 'hsl(25 95% 33%)'
                        return <Cell key={`cell-${index}`} fill={fillColor} stroke={strokeColor} />
                    })}
                </Bar>
            </BarChart>
        </ChartContainer>
    )
}
