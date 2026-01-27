'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
    CartesianGrid,
    Customized,
    ErrorBar,
    LabelList,
    Legend,
    Scatter,
    ScatterChart,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

import type { LeaderboardEntry } from '@/types'
import { getSeriesColor } from '@/lib/chart-colors'
import { ChartContainer } from '@/components/ui/chart'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type XAxisMetric = 'time' | 'cost'
type YAxisMetric = string // e.g., 'Top-1', 'Top-5'

type ParetoChartClientWrapperProps = {
    entries: LeaderboardEntry[]
    availableTopKMetrics: string[]
}

type ChartDataPoint = {
    x: number
    y: number
    yError: [number, number] // [error_down, error_up]
    algorithmName: string
    modelFamilyName: string
    seriesKey: string
    version: string
}

export function ParetoChartClientWrapper({ entries, availableTopKMetrics }: ParetoChartClientWrapperProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const selectedX = (searchParams.get('paretoX') as XAxisMetric) || 'cost'
    const defaultY = availableTopKMetrics.includes('Top-10') ? 'Top-10' : availableTopKMetrics[0]
    const selectedY = (searchParams.get('paretoY') as YAxisMetric) || defaultY

    const handleAxisChange = (axis: 'x' | 'y', value: string) => {
        if (!value) return // prevent unselecting from toggle group
        const params = new URLSearchParams(searchParams.toString())
        const key = axis === 'x' ? 'paretoX' : 'paretoY'
        params.set(key, value)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const chartDataByFamily = useMemo(() => {
        const data: ChartDataPoint[] = entries
            .map((entry) => {
                const metric = entry.metrics.topKAccuracy?.[selectedY]
                const xValue = selectedX === 'time' ? entry.totalWallTime : entry.totalCost
                if (!metric || xValue == null) return null

                return {
                    x: selectedX === 'time' ? xValue / 60 : xValue,
                    y: metric.value * 100,
                    yError: [metric.value * 100 - metric.ciLower * 100, metric.ciUpper * 100 - metric.value * 100] as [
                        number,
                        number,
                    ],
                    algorithmName: entry.algorithmName,
                    modelFamilyName: entry.modelFamilyName,
                    seriesKey: `${entry.modelFamilyName} ${entry.version}`,
                    version: entry.version,
                }
            })
            .filter((d): d is NonNullable<typeof d> => d !== null)

        const grouped = new Map<string, { algorithmName: string; data: ChartDataPoint[] }>()
        for (const point of data) {
            if (!grouped.has(point.seriesKey)) {
                grouped.set(point.seriesKey, {
                    algorithmName: point.algorithmName,
                    data: [],
                })
            }
            grouped.get(point.seriesKey)!.data.push(point)
        }

        grouped.forEach((series) => series.data.sort((a, b) => a.x - b.x))
        return grouped
    }, [entries, selectedX, selectedY])

    const yAxisDomain: [number, number] = [0, 100]
    const yAxisTicks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

    // Calculate max x value and add padding (15%) for labels, plus generate nice ticks
    const { maxX, xAxisTicks } = useMemo(() => {
        const allData = Array.from(chartDataByFamily.values()).flatMap((s) => s.data)
        if (allData.length === 0) return { maxX: 100, xAxisTicks: [0, 20, 40, 60, 80, 100] }

        const dataMax = Math.max(...allData.map((d) => d.x))
        const paddedMax = dataMax * 1.15 // Add 15% padding for labels

        // Calculate nice tick interval (aim for ~8-10 ticks)
        const range = paddedMax
        const roughInterval = range / 8

        // Round to nice number (1, 2, 5, 10, 20, 50, 100, etc.)
        const magnitude = Math.pow(10, Math.floor(Math.log10(roughInterval)))
        const normalized = roughInterval / magnitude
        let niceInterval: number
        if (normalized < 1.5) niceInterval = 1 * magnitude
        else if (normalized < 3) niceInterval = 2 * magnitude
        else if (normalized < 7) niceInterval = 5 * magnitude
        else niceInterval = 10 * magnitude

        // Generate ticks from 0 to paddedMax
        const ticks: number[] = []
        for (let tick = 0; tick <= paddedMax; tick += niceInterval) {
            ticks.push(tick)
        }

        return { maxX: paddedMax, xAxisTicks: ticks }
    }, [chartDataByFamily])

    // Calculate Pareto frontier
    const paretoFrontier = useMemo(() => {
        const allData = Array.from(chartDataByFamily.values()).flatMap((s) => s.data)
        if (allData.length === 0) return []

        // Sort by x-axis (cost/time) ascending
        const sorted = [...allData].sort((a, b) => a.x - b.x)

        // Build frontier: keep points where y increases (or stays same for first occurrence)
        const frontier: Array<{ x: number; y: number }> = []
        let maxY = -Infinity

        for (const point of sorted) {
            if (point.y >= maxY) {
                frontier.push({ x: point.x, y: point.y })
                maxY = point.y
            }
        }

        return frontier
    }, [chartDataByFamily])

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm font-medium">X-Axis:</span>
                    <ToggleGroup
                        type="single"
                        value={selectedX}
                        onValueChange={(v) => handleAxisChange('x', v)}
                        size="sm"
                    >
                        <ToggleGroupItem value="time">Time (min)</ToggleGroupItem>
                        <ToggleGroupItem value="cost" disabled={!entries.some((e) => e.totalCost != null)}>
                            Cost ($)
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm font-medium">Y-Axis:</span>
                    <ToggleGroup
                        type="single"
                        value={selectedY}
                        onValueChange={(v) => handleAxisChange('y', v)}
                        size="sm"
                    >
                        {availableTopKMetrics.map((metric) => (
                            <ToggleGroupItem key={metric} value={metric}>
                                {metric}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </div>
            </div>

            <ChartContainer config={{}} className="h-[450px] w-full">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                        type="number"
                        dataKey="x"
                        name={selectedX === 'time' ? 'Time (min)' : 'Cost ($)'}
                        label={{
                            value: selectedX === 'time' ? 'Time (minutes)' : 'Cost (USD)',
                            position: 'insideBottom',
                            offset: -15,
                        }}
                        domain={[0, maxX]}
                        ticks={xAxisTicks}
                        tickFormatter={(val: number) =>
                            val > 1000 ? val.toExponential(1) : val.toFixed(selectedX === 'time' ? 0 : 2)
                        }
                    />
                    <YAxis
                        type="number"
                        dataKey="y"
                        name={selectedY}
                        unit="%"
                        domain={yAxisDomain}
                        ticks={yAxisTicks}
                        label={{ value: `${selectedY} Accuracy`, angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null
                            const data = payload[0].payload

                            // Pareto frontier points only have x/y, skip detailed tooltip
                            if (!data.algorithmName) {
                                return (
                                    <div className="bg-background border-border rounded-lg border p-2 shadow-lg">
                                        <div className="mb-1 font-semibold">Pareto Frontier</div>
                                        <div className="flex flex-col gap-1 text-sm">
                                            <div className="flex items-center justify-between gap-4">
                                                <span className="text-muted-foreground">
                                                    {selectedX === 'time' ? 'Time:' : 'Cost:'}
                                                </span>
                                                <span className="font-medium">
                                                    {selectedX === 'time'
                                                        ? `${(data.x as number).toFixed(1)} min`
                                                        : `$${(data.x as number).toFixed(2)}`}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between gap-4">
                                                <span className="text-muted-foreground">{selectedY}:</span>
                                                <span className="font-medium">{(data.y as number).toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            }

                            return (
                                <div className="bg-background border-border rounded-lg border p-2 shadow-lg">
                                    <div className="text-muted-foreground mb-1 text-xs">{data.algorithmName}</div>
                                    <div className="mb-2 font-semibold">{data.modelFamilyName}</div>
                                    <div className="text-muted-foreground mb-1 text-xs">{data.version}</div>
                                    <div className="flex flex-col gap-1 text-sm">
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-muted-foreground">
                                                {selectedX === 'time' ? 'Time:' : 'Cost:'}
                                            </span>
                                            <span className="font-medium">
                                                {selectedX === 'time'
                                                    ? `${(data.x as number).toFixed(1)} min`
                                                    : `$${(data.x as number).toFixed(2)}`}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-muted-foreground">{selectedY}:</span>
                                            <span className="font-medium">{(data.y as number).toFixed(1)}%</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-muted-foreground">95% CI:</span>
                                            <span className="font-mono text-xs">
                                                [{(data.y - data.yError[0]).toFixed(1)},{' '}
                                                {(data.y + data.yError[1]).toFixed(1)}]
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        }}
                    />
                    <Legend wrapperStyle={{ bottom: 0 }} />

                    {Array.from(chartDataByFamily.entries()).map(([seriesKey, series]) => {
                        // Calculate color based on algorithm and series index within that algorithm
                        const seriesInAlgorithm = Array.from(chartDataByFamily.entries()).filter(
                            ([_, s]) => s.algorithmName === series.algorithmName
                        )
                        const seriesIndex = seriesInAlgorithm.findIndex(([k]) => k === seriesKey)
                        const color = getSeriesColor(series.algorithmName, seriesKey, seriesIndex)

                        return (
                            <Scatter key={seriesKey} name={seriesKey} data={series.data} fill={color} shape="circle">
                                <ErrorBar
                                    dataKey="yError"
                                    width={4}
                                    strokeWidth={1.5}
                                    stroke={color}
                                    strokeOpacity={0.6}
                                    direction="y"
                                />
                                <LabelList
                                    dataKey="modelFamilyName"
                                    position="right"
                                    offset={8}
                                    fontSize={9}
                                    fill={color}
                                    fontWeight={500}
                                />
                            </Scatter>
                        )
                    })}

                    {/* Pareto Frontier Line - rendered as custom SVG path */}
                    {paretoFrontier.length > 1 && (
                        <Customized
                            component={(props: {
                                xAxisMap?: Record<string, { scale: (v: number) => number }>
                                yAxisMap?: Record<string, { scale: (v: number) => number }>
                            }) => {
                                const { xAxisMap, yAxisMap } = props
                                if (!xAxisMap || !yAxisMap) return null

                                const xScale = Object.values(xAxisMap)[0]?.scale
                                const yScale = Object.values(yAxisMap)[0]?.scale
                                if (!xScale || !yScale) return null

                                // Build SVG path from frontier points
                                const pathData = paretoFrontier
                                    .map((point, i) => {
                                        const x = xScale(point.x)
                                        const y = yScale(point.y)
                                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
                                    })
                                    .join(' ')

                                return (
                                    <path
                                        d={pathData}
                                        fill="none"
                                        className="stroke-muted-foreground"
                                        strokeWidth={1}
                                        strokeDasharray="8 4"
                                        strokeLinecap="round"
                                    />
                                )
                            }}
                        />
                    )}
                </ScatterChart>
            </ChartContainer>
        </div>
    )
}
