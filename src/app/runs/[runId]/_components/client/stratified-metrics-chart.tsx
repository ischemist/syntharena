'use client'

import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ErrorBar, XAxis, YAxis } from 'recharts'

import type { StratifiedMetric } from '@/types'
import { filterPlateauStratifiedMetrics } from '@/lib/utils'
import { getMetricColors } from '@/components/theme/chart-palette'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip } from '@/components/ui/chart'

type StratifiedMetricsChartProps = {
    metrics: Array<{
        name: string
        stratified: StratifiedMetric
    }>
    minSamples?: number // Minimum samples to show a group
}

// Track which specific bar is being hovered
type HoveredBar = {
    metricKey: string
    length: number
} | null

/**
 * Grouped bar chart visualization of length-stratified metrics.
 * Shows metrics broken down by route length with error bars.
 *
 * Client component using recharts for interactive visualization.
 */
export function StratifiedMetricsChart({ metrics, minSamples = 5 }: StratifiedMetricsChartProps) {
    const [hoveredBar, setHoveredBar] = useState<HoveredBar>(null)
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

    // Filter out duplicate plateau values in Top-k metrics
    const filteredMetrics = filterPlateauStratifiedMetrics(metrics)

    // Extract all unique route lengths across all metrics
    const allLengths = new Set<number>()
    filteredMetrics.forEach((m) => {
        Object.keys(m.stratified.byGroup).forEach((length) => {
            const len = parseInt(length)
            const metric = m.stratified.byGroup[len]
            // Only include lengths with sufficient samples
            if (metric.nSamples >= minSamples) {
                allLengths.add(len)
            }
        })
    })

    const sortedLengths = Array.from(allLengths).sort((a, b) => a - b)

    // Transform data for recharts grouped bar chart
    // Each row is a route length, with columns for each metric
    const chartData = sortedLengths.map((length, lengthIndex) => {
        const row: Record<string, unknown> = {
            length,
            // Unique identifier for this data point to help with key generation
            _id: `length-${length}-idx-${lengthIndex}`,
        }

        filteredMetrics.forEach((m, metricIndex) => {
            const metric = m.stratified.byGroup[length]
            if (metric) {
                const metricKey = m.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
                const value = metric.value * 100 // Convert to percentage
                const ciLower = metric.ciLower * 100
                const ciUpper = metric.ciUpper * 100
                row[metricKey] = value
                // Store absolute CI bounds for tooltip display
                row[`${metricKey}_ci_lower`] = ciLower
                row[`${metricKey}_ci_upper`] = ciUpper
                // Compute deviations for error bars (recharts expects deviation from value)
                // Add small unique offset to prevent duplicate coordinate issues
                const errorOffset = metricIndex * 0.001 // Tiny offset per metric
                row[`${metricKey}_error`] = [value - ciLower + errorOffset, ciUpper - value + errorOffset]
                row[`${metricKey}_n`] = metric.nSamples
                row[`${metricKey}_reliability`] = metric.reliability
            }
        })

        return row
    })

    // Chart configuration using semantic color mapping with fallback
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

    // If no valid data, show message
    if (chartData.length === 0) {
        return (
            <div className="text-muted-foreground flex h-[400px] w-full items-center justify-center">
                <p>No stratified data available (minimum {minSamples} samples per length required)</p>
            </div>
        )
    }

    return (
        <ChartContainer config={chartConfig} className="h-[400px] w-full" suppressHydrationWarning={true}>
            <BarChart
                data={chartData}
                margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 20,
                }}
                onMouseMove={(e) => {
                    if (e?.chartX !== undefined && e?.chartY !== undefined) {
                        setMousePos({ x: e.chartX, y: e.chartY })
                    }
                }}
            >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                    dataKey="length"
                    stroke="hsl(var(--foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    label={{ value: 'Route Length', position: 'insideBottom', offset: -10 }}
                />
                <YAxis
                    stroke="hsl(var(--foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}%`}
                    domain={[0, 100]}
                    label={{ value: 'Percentage', angle: -90, position: 'insideLeft' }}
                />
                <ChartTooltip
                    isAnimationActive={false}
                    position={{ x: mousePos.x + 15, y: mousePos.y - 10 }}
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                    content={({ active, payload, label }) => {
                        // Only show tooltip when hovering over a specific bar
                        if (!active || !payload || payload.length === 0 || !hoveredBar) {
                            return null
                        }

                        // Verify the hovered bar matches the current tooltip position
                        if (hoveredBar.length !== label) {
                            return null
                        }

                        // Get the data point for this route length
                        const dataPoint = payload[0]?.payload
                        const metricKey = hoveredBar.metricKey
                        const metricName = chartConfig[metricKey]?.label || metricKey
                        const value = dataPoint[metricKey]
                        const color = chartConfig[metricKey]?.color

                        return (
                            <div className="border-border/50 bg-background rounded-lg border px-3 py-2 shadow-xl">
                                <div className="mb-2 text-sm font-medium">Route Length: {label}</div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
                                        <span className="text-sm font-medium">{metricName}</span>
                                    </div>
                                    <div className="ml-4 space-y-0.5">
                                        <div className="flex w-full items-center justify-between gap-4">
                                            <span className="text-muted-foreground text-xs">Value:</span>
                                            <span className="font-mono text-sm font-medium">
                                                {typeof value === 'number' ? value.toFixed(1) : value}%
                                            </span>
                                        </div>
                                        <div className="flex w-full items-center justify-between gap-4">
                                            <span className="text-muted-foreground text-xs">95% CI:</span>
                                            <span className="font-mono text-xs">
                                                [{dataPoint[`${metricKey}_ci_lower`]?.toFixed(1)},{' '}
                                                {dataPoint[`${metricKey}_ci_upper`]?.toFixed(1)}]
                                            </span>
                                        </div>
                                        <div className="flex w-full items-center justify-between gap-4">
                                            <span className="text-muted-foreground text-xs">n:</span>
                                            <span className="font-mono text-xs">{dataPoint[`${metricKey}_n`]}</span>
                                        </div>
                                        {dataPoint[`${metricKey}_reliability`]?.code !== 'OK' && (
                                            <div className="border-destructive/50 bg-destructive/10 mt-1 rounded border px-2 py-1 text-xs">
                                                {dataPoint[`${metricKey}_reliability`]?.message}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    }}
                />
                <ChartLegend content={<ChartLegendContent />} />
                {filteredMetrics.map((m) => {
                    const metricKey = m.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
                    const barColor = chartConfig[metricKey].color
                    const errorBarColor = chartConfig[metricKey].errorBarColor

                    return (
                        <Bar
                            key={metricKey}
                            dataKey={metricKey}
                            fill={barColor}
                            radius={[4, 4, 0, 0]}
                            onMouseEnter={(data) => {
                                if (data && data.length !== undefined) {
                                    setHoveredBar({ metricKey, length: data.length as number })
                                }
                            }}
                            onMouseLeave={() => setHoveredBar(null)}
                        >
                            {/* ErrorBar using pre-computed array for asymmetric error bars */}
                            {chartData.some((row) => {
                                const errorData = row[`${metricKey}_error`] as [number, number] | undefined
                                return errorData && (errorData[0] > 0.01 || errorData[1] > 0.01)
                            }) && (
                                <ErrorBar
                                    dataKey={(entry) => entry[`${metricKey}_error`]}
                                    width={6}
                                    strokeWidth={2.5}
                                    stroke={errorBarColor}
                                />
                            )}
                        </Bar>
                    )
                })}
            </BarChart>
        </ChartContainer>
    )
}
