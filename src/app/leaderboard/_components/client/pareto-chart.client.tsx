'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CartesianGrid, ErrorBar, LabelList, Legend, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'

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
                    seriesKey: `${entry.modelFamilyName} v${entry.version}`,
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
                        domain={['dataMin', 'dataMax']}
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
                        label={{ value: `${selectedY} Accuracy`, angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null
                            const data = payload[0].payload
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
                            <Scatter
                                key={seriesKey}
                                name={seriesKey}
                                data={series.data}
                                fill={color}
                                line
                                shape="circle"
                            >
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
                                    position="top"
                                    offset={8}
                                    fontSize={10}
                                    fill={color}
                                    fontWeight={500}
                                />
                            </Scatter>
                        )
                    })}
                </ScatterChart>
            </ChartContainer>
        </div>
    )
}
