'use client'
'use no memo'

import { createContext, useContext, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { flexRender, getCoreRowModel, getSortedRowModel, SortingState, useReactTable } from '@tanstack/react-table'
import { BarChart3, Table2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ErrorBar, XAxis, YAxis } from 'recharts'

import type { LeaderboardEntry } from '@/types'
import { cn } from '@/lib/utils'
import { getMetricColors } from '@/components/theme/chart-palette'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { createLeaderboardColumns } from './leaderboard-columns'
import { useSelectedTopK } from './page-level-top-k-selector'

type BenchmarkMetricsDisplayProps = {
    entries: LeaderboardEntry[]
    benchmarkSeries: LeaderboardEntry['benchmarkSeries']
    topKMetricNames: string[]
    selectedTopK?: string[] // Optional - will use context if not provided
}

// Create context for view mode (to share between toggle and display)
type DisplayModeContextType = {
    display: 'table' | 'chart'
}
const DisplayModeContext = createContext<DisplayModeContextType>({
    display: 'table',
})

/**
 * Wrapper that provides view mode from URL to children via context.
 * Must wrap both MetricsViewToggleButtons and BenchmarkMetricsDisplay.
 * Following App Router Manifesto: URL is canon - view state is shareable.
 */
export function MetricsDisplayProvider({ children }: { children: React.ReactNode }) {
    const searchParams = useSearchParams()
    const display = (searchParams.get('display') as 'table' | 'chart') || 'table'

    return <DisplayModeContext.Provider value={{ display }}>{children}</DisplayModeContext.Provider>
}

/**
 * View toggle buttons for table/chart display.
 * Reads view mode from context, writes to URL.
 */
export function MetricsDisplayToggleButtons() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { display } = useContext(DisplayModeContext)

    const handleDisplayChange = (newDisplay: 'table' | 'chart') => {
        const params = new URLSearchParams(searchParams.toString())
        if (newDisplay === 'table') {
            params.delete('display')
        } else {
            params.set('display', newDisplay)
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    return (
        <div className="flex gap-2">
            <Button
                variant={display === 'table' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleDisplayChange('table')}
                className="gap-2"
            >
                <Table2 className="h-4 w-4" />
                Table
            </Button>
            <Button
                variant={display === 'chart' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleDisplayChange('chart')}
                className="gap-2"
            >
                <BarChart3 className="h-4 w-4" />
                Chart
            </Button>
        </div>
    )
}

/**
 * Client component for displaying benchmark metrics with table/chart toggle.
 * Uses context for view mode (managed by MetricsViewProvider wrapper).
 *
 * Following App Router Manifesto:
 * - Client component for interactive UI
 * - Receives data and uses context for view mode and selectedTopK
 * - Uses TanStack Table for sorting functionality
 */
export function BenchmarkMetricsDisplay({
    entries,
    benchmarkSeries,
    topKMetricNames,
    selectedTopK: propSelectedTopK,
}: BenchmarkMetricsDisplayProps) {
    const contextSelectedTopK = useSelectedTopK()
    const selectedTopK = propSelectedTopK ?? contextSelectedTopK
    const { display } = useContext(DisplayModeContext)

    const hasTopKMetrics = topKMetricNames.length > 0

    // Determine which Top-K metrics to show in the table/chart
    // Join to string for stable comparison - prevents column recreation on reference changes
    const displayedTopKKey = hasTopKMetrics ? selectedTopK.join(',') : ''
    const displayedTopK = useMemo(() => (displayedTopKKey ? displayedTopKKey.split(',') : []), [displayedTopKKey])

    // TanStack Table state
    const [sorting, setSorting] = useState<SortingState>([])

    // Create columns based on displayed Top-K metrics
    const columns = useMemo(
        () => createLeaderboardColumns(benchmarkSeries, displayedTopK),
        [benchmarkSeries, displayedTopK]
    )

    // Initialize TanStack Table
    const table = useReactTable({
        data: entries,
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    })

    return (
        <div>
            {/* Content area */}
            {display === 'table' ? (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        return (
                                            <TableHead key={header.id} className={cn('px-2')}>
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(header.column.columnDef.header, header.getContext())}
                                            </TableHead>
                                        )
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow key={row.id}>
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id} className="px-2">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center">
                                        No results.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>

                    {!hasTopKMetrics && (
                        <p className="text-muted-foreground mt-4 text-sm">
                            * Top-K accuracy metrics are only available for benchmarks with acceptable routes
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

    // Get semantic colors for this metric
    const colors = getMetricColors(metricName, 0)

    const chartConfig = {
        value: {
            label: metricName,
            color: colors.bar,
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
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} fill={colors.bar}>
                        <ErrorBar
                            dataKey={(entry) => [entry.errorLower, entry.errorUpper]}
                            width={6}
                            strokeWidth={2.5}
                            stroke={colors.errorBar}
                        />
                    </Bar>
                </BarChart>
            </ChartContainer>
        </div>
    )
}
