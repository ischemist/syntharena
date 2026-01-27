'use client'

import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ErrorBar, XAxis, YAxis } from 'recharts'

import type { MetricResult } from '@/types'
import { metricColors } from '@/components/theme/chart-palette'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'

export interface BenchmarkPerformanceData {
    benchmarkId: string
    benchmarkName: string
    top10Accuracy: MetricResult
}

interface BenchmarkPerformanceChartProps {
    data: BenchmarkPerformanceData[]
}

type HoveredBar = {
    benchmarkId: string
} | null

/**
 * Client component displaying Top-10 accuracy across benchmarks for a model instance.
 * Horizontal bar chart with benchmark names on Y-axis, Top-10 % on X-axis.
 */
export function BenchmarkPerformanceChart({ data }: BenchmarkPerformanceChartProps) {
    const [hoveredBar, setHoveredBar] = useState<HoveredBar>(null)
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

    if (data.length === 0) {
        return (
            <div className="text-muted-foreground py-8 text-center text-sm">
                <p>No Top-10 accuracy data available for this model.</p>
            </div>
        )
    }

    // Transform data for recharts
    const chartData = data.map((d) => ({
        benchmarkId: d.benchmarkId,
        benchmarkName: d.benchmarkName,
        value: d.top10Accuracy.value * 100,
        ciLower: d.top10Accuracy.ciLower * 100,
        ciUpper: d.top10Accuracy.ciUpper * 100,
        error: [
            d.top10Accuracy.value * 100 - d.top10Accuracy.ciLower * 100,
            d.top10Accuracy.ciUpper * 100 - d.top10Accuracy.value * 100,
        ],
        nSamples: d.top10Accuracy.nSamples,
        reliability: d.top10Accuracy.reliability,
    }))

    const chartConfig = {
        top10: {
            label: 'Top-10 Accuracy',
            color: metricColors['Top-10'].bar,
            errorBarColor: metricColors['Top-10'].errorBar,
        },
    }

    // Calculate dynamic height based on number of benchmarks
    const chartHeight = Math.max(300, data.length * 60)

    return (
        <ChartContainer config={chartConfig} className="w-full" style={{ height: `${chartHeight}px` }}>
            <BarChart
                data={chartData}
                layout="vertical"
                margin={{
                    top: 20,
                    right: 30,
                    left: 150,
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
                    type="number"
                    stroke="hsl(var(--foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}%`}
                    domain={[0, 100]}
                />
                <YAxis
                    type="category"
                    dataKey="benchmarkName"
                    stroke="hsl(var(--foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={140}
                />
                <ChartTooltip
                    isAnimationActive={false}
                    position={{ x: mousePos.x + 15, y: mousePos.y - 10 }}
                    cursor={false}
                    content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0 || !hoveredBar) {
                            return null
                        }

                        const dataPoint = payload[0]?.payload as (typeof chartData)[0]

                        return (
                            <div className="border-border/50 bg-background rounded-lg border px-3 py-2 shadow-xl">
                                <div className="mb-2 flex items-center gap-2">
                                    <div
                                        className="h-2.5 w-2.5 rounded-sm"
                                        style={{ backgroundColor: chartConfig.top10.color }}
                                    />
                                    <span className="text-sm font-medium">{dataPoint.benchmarkName}</span>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex w-full items-center justify-between gap-2">
                                        <span className="text-muted-foreground text-xs">Top-10:</span>
                                        <span className="font-mono text-sm font-medium">
                                            {dataPoint.value.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="flex w-full items-center justify-between gap-2">
                                        <span className="text-muted-foreground text-xs">95% CI:</span>
                                        <span className="font-mono text-xs">
                                            [{dataPoint.ciLower.toFixed(1)}, {dataPoint.ciUpper.toFixed(1)}]
                                        </span>
                                    </div>
                                    <div className="flex w-full items-center justify-between gap-2">
                                        <span className="text-muted-foreground text-xs">n:</span>
                                        <span className="font-mono text-xs">{dataPoint.nSamples}</span>
                                    </div>
                                    {dataPoint.reliability.code !== 'OK' && (
                                        <div className="border-destructive/50 bg-destructive/10 mt-2 rounded border px-2 py-1 text-xs">
                                            {dataPoint.reliability.message}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    }}
                />
                <Bar
                    dataKey="value"
                    fill={chartConfig.top10.color}
                    radius={[0, 4, 4, 0]}
                    onMouseEnter={(data) => {
                        setHoveredBar({ benchmarkId: data.benchmarkId as string })
                    }}
                    onMouseLeave={() => setHoveredBar(null)}
                >
                    <ErrorBar
                        dataKey="error"
                        width={6}
                        strokeWidth={2.5}
                        stroke={chartConfig.top10.errorBarColor}
                        direction="x"
                    />
                </Bar>
            </BarChart>
        </ChartContainer>
    )
}
