'use client'

import { Bar, BarChart, CartesianGrid, ErrorBar, XAxis, YAxis } from 'recharts'

import type { MetricResult } from '@/types'
import { filterPlateauMetrics } from '@/lib/utils'
import { getMetricColors } from '@/components/theme/chart-palette'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip } from '@/components/ui/chart'

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

    // Transform data for recharts - create a single row with all metrics as columns
    // This allows us to use separate Bar components for each metric with individual error bar colors
    const chartData = [
        filteredMetrics.reduce(
            (row, m) => {
                const metricKey = m.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
                const value = m.metric.value * 100 // Convert to percentage
                const ciLower = m.metric.ciLower * 100
                const ciUpper = m.metric.ciUpper * 100

                row[metricKey] = value
                row[`${metricKey}_ci_lower`] = ciLower
                row[`${metricKey}_ci_upper`] = ciUpper
                row[`${metricKey}_error`] = [value - ciLower, ciUpper - value]
                row[`${metricKey}_n`] = m.metric.nSamples
                row[`${metricKey}_reliability`] = m.metric.reliability
                return row
            },
            { name: 'Metrics' } as Record<string, unknown>
        ),
    ]

    // Chart configuration with semantic colors
    const chartConfig = filteredMetrics.reduce(
        (config, m, idx) => {
            const metricKey = m.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
            const colors = getMetricColors(m.name, idx)
            config[metricKey] = {
                label: m.name,
                color: colors.bar,
                errorBarColor: colors.errorBar,
            }
            return config
        },
        {} as Record<string, { label: string; color: string; errorBarColor: string }>
    )

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
                <XAxis
                    dataKey="name"
                    stroke="hsl(var(--foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    hide
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
                    content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null

                        const dataPoint = payload[0]?.payload
                        const metricKey = payload[0]?.dataKey as string
                        const metricName = chartConfig[metricKey]?.label || metricKey
                        const value = payload[0]?.value
                        const color = chartConfig[metricKey]?.color

                        return (
                            <div className="border-border/50 bg-background rounded-lg border px-3 py-2 shadow-xl">
                                <div className="mb-2 flex items-center gap-2">
                                    <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
                                    <span className="text-sm font-medium">{metricName}</span>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex w-full items-center justify-between gap-2">
                                        <span className="text-muted-foreground">Value:</span>
                                        <span className="font-mono font-medium">
                                            {typeof value === 'number' ? value.toFixed(1) : value}%
                                        </span>
                                    </div>
                                    <div className="flex w-full items-center justify-between gap-2">
                                        <span className="text-muted-foreground">95% CI:</span>
                                        <span className="font-mono text-xs">
                                            [{(dataPoint[`${metricKey}_ci_lower`] as number)?.toFixed(1)},{' '}
                                            {(dataPoint[`${metricKey}_ci_upper`] as number)?.toFixed(1)}]
                                        </span>
                                    </div>
                                    <div className="flex w-full items-center justify-between gap-2">
                                        <span className="text-muted-foreground">n:</span>
                                        <span className="font-mono">{dataPoint[`${metricKey}_n`] as number}</span>
                                    </div>
                                    {(dataPoint[`${metricKey}_reliability`] as { code: string; message: string })
                                        ?.code !== 'OK' && (
                                        <div className="border-destructive/50 bg-destructive/10 mt-2 rounded border px-2 py-1 text-xs">
                                            {
                                                (
                                                    dataPoint[`${metricKey}_reliability`] as {
                                                        code: string
                                                        message: string
                                                    }
                                                )?.message
                                            }
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    }}
                />
                <ChartLegend className="mt-2" content={<ChartLegendContent />} />
                {filteredMetrics.map((m) => {
                    const metricKey = m.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
                    const barColor = chartConfig[metricKey].color
                    const errorBarColor = chartConfig[metricKey].errorBarColor
                    const isReliable = m.metric.reliability.code === 'OK'

                    return (
                        <Bar
                            key={metricKey}
                            dataKey={metricKey}
                            fill={barColor}
                            fillOpacity={isReliable ? 1 : 0.5}
                            radius={[4, 4, 0, 0]}
                            name={m.name}
                        >
                            <ErrorBar
                                dataKey={(entry) => entry[`${metricKey}_error`]}
                                width={6}
                                strokeWidth={2.5}
                                stroke={errorBarColor}
                            />
                        </Bar>
                    )
                })}
            </BarChart>
        </ChartContainer>
    )
}
