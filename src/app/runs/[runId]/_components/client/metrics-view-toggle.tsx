'use client'

import { useState } from 'react'
import { BarChart3, Table2 } from 'lucide-react'

import type { MetricResult } from '@/types'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { MetricCell } from './metric-cell'
import { MetricsChart } from './metrics-chart'

type MetricsViewToggleProps = {
    metrics: Array<{
        name: string
        metric: MetricResult
    }>
    nSamples: number
}

/**
 * Client component that allows toggling between table and chart views.
 * Uses local state (not URL state) since this is ephemeral UI preference.
 *
 * Following App Router Manifesto:
 * - Client component for interactive UI (useState, onClick)
 * - Receives data as props from server parent
 * - Local state only for non-canonical UI state
 */
export function MetricsViewToggle({ metrics, nSamples }: MetricsViewToggleProps) {
    const [view, setView] = useState<'table' | 'chart'>('table')

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
                                    {metrics.map((col) => (
                                        <TableHead key={col.name} className="min-w-[160px] text-center">
                                            {col.name}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    {metrics.map((col, idx) => (
                                        <TableCell
                                            key={col.name}
                                            className={
                                                idx === metrics.length - 1
                                                    ? 'pr-12 text-center' // Extra padding right for last column upper CI
                                                    : 'text-center'
                                            }
                                        >
                                            <MetricCell metric={col.metric} showBadge />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>

                    <div className="text-muted-foreground mt-4 text-sm">
                        <p>
                            n = {nSamples} target{nSamples !== 1 ? 's' : ''}
                        </p>
                    </div>
                </>
            ) : (
                <>
                    <MetricsChart metrics={metrics} />
                    <div className="text-muted-foreground mt-4 text-center text-sm">
                        <p>
                            n = {nSamples} target{nSamples !== 1 ? 's' : ''}. Error bars show 95% confidence intervals.
                        </p>
                    </div>
                </>
            )}
        </div>
    )
}
