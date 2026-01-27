'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CartesianGrid, ErrorBar, Legend, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'

import type { LeaderboardEntry } from '@/types'
import { getProceduralColor } from '@/lib/chart-colors'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
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
    modelName: string
    version: string
}

export function ParetoChartClientWrapper({ entries, availableTopKMetrics }: ParetoChartClientWrapperProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const selectedX = (searchParams.get('paretoX') as XAxisMetric) || 'time'
    const defaultY = availableTopKMetrics.includes('Top-1') ? 'Top-1' : availableTopKMetrics[0]
    const selectedY = (searchParams.get('paretoY') as YAxisMetric) || defaultY

    const handleAxisChange = (axis: 'x' | 'y', value: string) => {
        if (!value) return // prevent unselecting from toggle group
        const params = new URLSearchParams(searchParams.toString())
        const key = axis === 'x' ? 'paretoX' : 'paretoY'
        params.set(key, value)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const chartDataByFamily = useMemo(() => {
        const data: Array<ChartDataPoint & { familyName: string }> = entries
            .map((entry) => {
                const metric = entry.metrics.topKAccuracy?.[selectedY]
                const xValue = selectedX === 'time' ? entry.totalWallTime : entry.totalCost
                if (!metric || xValue == null) return null

                return {
                    x: selectedX === 'time' ? xValue / 60 : xValue,
                    y: metric.value * 100,
                    yError: [metric.value * 100 - metric.ciLower * 100, metric.ciUpper * 100 - metric.value * 100],
                    modelName: entry.modelName,
                    version: entry.version,
                    familyName: entry.modelName,
                }
            })
            .filter((d): d is NonNullable<typeof d> => d !== null)

        const grouped = new Map<string, ChartDataPoint[]>()
        for (const point of data) {
            if (!grouped.has(point.familyName)) {
                grouped.set(point.familyName, [])
            }
            grouped.get(point.familyName)!.push(point)
        }

        grouped.forEach((points) => points.sort((a, b) => a.x - b.x))
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
                        content={
                            <ChartTooltipContent
                                labelFormatter={(_, payload) => payload?.[0]?.payload.modelName}
                                formatter={(value, name, item) => (
                                    <>
                                        <div className="font-medium">{item.payload.version}</div>
                                        <div className="flex w-full items-center justify-between gap-2">
                                            <span className="text-muted-foreground">
                                                {selectedX === 'time' ? 'Time:' : 'Cost:'}
                                            </span>
                                            <span>
                                                {selectedX === 'time'
                                                    ? `${(item.payload.x as number).toFixed(1)} min`
                                                    : `$${(item.payload.x as number).toFixed(2)}`}
                                            </span>
                                        </div>
                                        <div className="flex w-full items-center justify-between gap-2">
                                            <span className="text-muted-foreground">{selectedY}:</span>
                                            <span>{(item.payload.y as number).toFixed(1)}%</span>
                                        </div>
                                        <div className="flex w-full items-center justify-between gap-2">
                                            <span className="text-muted-foreground">95% CI:</span>
                                            <span className="font-mono text-xs">
                                                [{(item.payload.y - item.payload.yError[0]).toFixed(1)},{' '}
                                                {(item.payload.y + item.payload.yError[1]).toFixed(1)}]
                                            </span>
                                        </div>
                                    </>
                                )}
                            />
                        }
                    />
                    <Legend wrapperStyle={{ bottom: 0 }} />
                    {Array.from(chartDataByFamily.entries()).map(([familyName, data]) => (
                        <Scatter
                            key={familyName}
                            name={familyName}
                            data={data}
                            fill={getProceduralColor(familyName)}
                            line
                            shape="circle"
                        >
                            <ErrorBar dataKey="yError" width={4} strokeWidth={1.5} strokeOpacity={0.8} direction="y" />
                        </Scatter>
                    ))}
                </ScatterChart>
            </ChartContainer>
        </div>
    )
}
