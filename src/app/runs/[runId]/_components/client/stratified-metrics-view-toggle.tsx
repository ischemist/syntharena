'use client'

import { useState } from 'react'
import { BarChart3, Table2 } from 'lucide-react'

import type { StratifiedMetric } from '@/types'
import { MetricCell } from '@/components/metrics'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { StratifiedMetricsChart } from './stratified-metrics-chart'

type StratifiedMetricsViewToggleProps = {
    metrics: Array<{
        name: string
        stratified: StratifiedMetric
    }>
}

/**
 * Client component that allows toggling between table and chart views for stratified metrics.
 * Uses local state (not URL state) since this is ephemeral UI preference.
 *
 * Following App Router Manifesto:
 * - Client component for interactive UI (useState, onClick)
 * - Receives data as props from server parent
 * - Local state only for non-canonical UI state
 */
export function StratifiedMetricsViewToggle({ metrics }: StratifiedMetricsViewToggleProps) {
    const [view, setView] = useState<'table' | 'chart'>('table')

    // Get all unique route lengths across all metrics
    const strataWithData = new Set<string>()
    metrics.forEach((m) => {
        Object.keys(m.stratified.byStratum).forEach((key) => strataWithData.add(key))
    })

    const sortedStrata = Array.from(strataWithData).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

    return (
        <div>
            {/* Toggle buttons */}
            <div className="mb-4 flex justify-end gap-2">
                <Button
                    variant={view === 'table' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setView('table')}
                    className="gap-2"
                >
                    <Table2 className="h-4 w-4" />
                    Table
                </Button>
                <Button
                    variant={view === 'chart' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setView('chart')}
                    className="gap-2"
                >
                    <BarChart3 className="h-4 w-4" />
                    Chart
                </Button>
            </div>

            {/* Content area */}
            {view === 'table' ? (
                <>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-32 text-center">Stratum</TableHead>
                                    {metrics.map((m) => (
                                        <TableHead key={m.name} className="min-w-[160px] text-center">
                                            {m.name}
                                        </TableHead>
                                    ))}
                                    <TableHead className="w-20 text-center">n</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedStrata.map((stratum) => {
                                    const hasData = metrics.some((m) => m.stratified.byStratum[stratum])
                                    if (!hasData) return null

                                    const nSamples = metrics[0].stratified.byStratum[stratum]?.nSamples

                                    return (
                                        <TableRow key={stratum}>
                                            <TableCell className="text-center font-medium">{stratum}</TableCell>
                                            {metrics.map((m) => {
                                                const metric = m.stratified.byStratum[stratum]
                                                if (!metric) {
                                                    return (
                                                        <TableCell
                                                            key={m.name}
                                                            className="text-muted-foreground text-center"
                                                        >
                                                            —
                                                        </TableCell>
                                                    )
                                                }

                                                return (
                                                    <TableCell key={m.name} className="text-center">
                                                        <MetricCell metric={metric} showBadge />
                                                    </TableCell>
                                                )
                                            })}
                                            <TableCell className="text-muted-foreground text-center">
                                                {nSamples}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="text-muted-foreground mt-4 text-sm">
                        <p>
                            Confidence intervals available on hover. Reliability indicators show LOW_N (insufficient
                            samples) or EXTREME_P (value near boundary).
                        </p>
                    </div>
                </>
            ) : (
                <>
                    <StratifiedMetricsChart metrics={metrics} minSamples={5} />
                    <div className="text-muted-foreground text-center text-sm">
                        <p>Error bars show 95% confidence intervals.</p>
                    </div>
                </>
            )}
        </div>
    )
}
