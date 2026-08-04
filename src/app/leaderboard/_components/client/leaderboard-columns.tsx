'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ColumnDef } from '@tanstack/react-table'
import { Check, GitCompareArrows, X } from 'lucide-react'

import type { LeaderboardEntry } from '@/types'
import { SubmissionBadge } from '@/components/badges/submission'
import { DataTableColumnHeader } from '@/components/data-table-column-header'
import { MetricCell } from '@/components/metrics'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function _buildLeaderboardRunHref(
    entry: Pick<LeaderboardEntry, 'runId' | 'evaluationId' | 'hasAcceptableRoutes'>,
    isDevMode: boolean
): string {
    const search = new URLSearchParams({ evaluation: entry.evaluationId })
    if (entry.hasAcceptableRoutes) search.set('layout', 'side-by-side')
    if (isDevMode) search.set('dev', 'true')
    return `/runs/${entry.runId}?${search.toString()}`
}

/**
 * Creates column definitions for the overall leaderboard table.
 * Includes model name, Tier-0, Solv-0, and dynamic Top-K accuracy columns.
 *
 * @param displayedTopK - Filtered list of Top-K metrics to actually show (based on user selection)
 */
export function createLeaderboardColumns(
    benchmarkSeries: LeaderboardEntry['benchmarkSeries'],
    displayedTopK: string[]
): ColumnDef<LeaderboardEntry>[] {
    const ActionCell = ({ row }: { row: any }) => {
        const searchParams = useSearchParams()
        const isDevMode = searchParams.get('dev') === 'true'
        const href = _buildLeaderboardRunHref(row.original, isDevMode)

        return (
            <div className="flex justify-center">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Link href={href}>
                                <GitCompareArrows className="text-muted-foreground hover:text-foreground h-4 w-4 transition-colors" />
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Visualize routes for this run</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        )
    }

    const columns: ColumnDef<LeaderboardEntry>[] = [
        // Model Name Column
        {
            accessorKey: 'modelName',
            id: 'modelName',
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Model" />,
            cell: ({ row }) => <div className="font-medium">{row.getValue('modelName')}</div>,
        },
        {
            id: 'version',
            accessorKey: 'version',
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Version" />,
            cell: ({ row }) => {
                const { version, modelInstanceSlug } = row.original
                return (
                    <div className="flex justify-center">
                        <Link href={`/models/${modelInstanceSlug}`} className="hover:underline">
                            <code className="bg-muted rounded px-1.5 py-0.5 text-sm">{version}</code>
                        </Link>
                    </div>
                )
            },
        },
        {
            accessorKey: 'metrics.tier0Validity.value',
            id: 'tier0Validity',
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Tier-0 valid" />,
            cell: ({ row }) => {
                const metric = row.original.metrics.tier0Validity
                return (
                    <div className="flex justify-center">
                        <MetricCell metric={metric} showBadge />
                    </div>
                )
            },
            sortingFn: (rowA, rowB) => {
                const a = rowA.original.metrics.tier0Validity.value
                const b = rowB.original.metrics.tier0Validity.value
                return a - b
            },
        },
        {
            accessorKey: 'metrics.solv0.value',
            id: 'solv0',
            header: ({ column, table }) => {
                const label = table.getRowModel().rows[0]?.original.metrics.solv0Label ?? 'stock'
                return <DataTableColumnHeader column={column} table={table} title={`Solv-0[${label}]`} />
            },
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <MetricCell metric={row.original.metrics.solv0} showBadge />
                </div>
            ),
            sortingFn: (rowA, rowB) => rowA.original.metrics.solv0.value - rowB.original.metrics.solv0.value,
        },
    ]

    // Add Top-K accuracy columns dynamically
    displayedTopK.forEach((metricName) => {
        columns.push({
            id: metricName,
            accessorFn: (row) => row.metrics.topKAccuracy?.[metricName]?.value,
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title={metricName} />,
            cell: ({ row }) => {
                const metric = row.original.metrics.topKAccuracy?.[metricName]
                return (
                    <div className="flex justify-center">{metric ? <MetricCell metric={metric} showBadge /> : '-'}</div>
                )
            },
            sortingFn: (rowA, rowB) => {
                const a = rowA.original.metrics.topKAccuracy?.[metricName]?.value ?? -1
                const b = rowB.original.metrics.topKAccuracy?.[metricName]?.value ?? -1
                return a - b
            },
        })
    })

    if (benchmarkSeries === 'REFERENCE') {
        columns.push({
            id: 'training',
            accessorFn: (row) => row.isRetrained,
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Re-Training" />,
            cell: ({ row }) => {
                const { isRetrained } = row.original
                const tooltipText =
                    isRetrained === true
                        ? 'Model was retrained on the standardized corpus for this benchmark.'
                        : isRetrained === false
                          ? "Model uses the author's official weights and was not retrained."
                          : 'Training status not applicable for this benchmark series.'

                return (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex justify-center">
                                    {isRetrained === true && <Check className="h-4 w-4 text-green-500" />}
                                    {isRetrained === false && <X className="h-4 w-4 text-red-500" />}
                                    {isRetrained === null && <span className="text-muted-foreground">-</span>}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>{tooltipText}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )
            },
            sortingFn: (rowA, rowB) => {
                const a = rowA.original.isRetrained
                const b = rowB.original.isRetrained
                if (a === b) return 0
                if (a === true) return 1 // true > false > null
                if (b === true) return -1
                if (a === false) return 1 // false > null
                if (b === false) return -1
                return 0
            },
        })
    }

    // Add Duration column (wall time in minutes)
    columns.push({
        accessorKey: 'totalWallTime',
        id: 'duration',
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Duration" />,
        cell: ({ row }) => {
            const wallTime = row.original.totalWallTime
            if (wallTime == null) return <div className="text-muted-foreground flex justify-center">-</div>
            const minutes = (wallTime / 60).toFixed(1)
            return <div className="flex justify-center font-mono text-sm">{minutes} min</div>
        },
        sortingFn: (rowA, rowB) => {
            const a = rowA.original.totalWallTime ?? -1
            const b = rowB.original.totalWallTime ?? -1
            return a - b
        },
    })

    // Add Cost column (USD)
    columns.push({
        accessorKey: 'totalCost',
        id: 'cost',
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Cost" />,
        cell: ({ row }) => {
            const cost = row.original.totalCost
            if (cost == null) return <div className="text-muted-foreground flex justify-center">-</div>
            return <div className="flex justify-center font-mono text-sm">${cost.toFixed(2)}</div>
        },
        sortingFn: (rowA, rowB) => {
            const a = rowA.original.totalCost ?? -1
            const b = rowB.original.totalCost ?? -1
            return a - b
        },
    })
    columns.push({
        accessorKey: 'submissionType',
        id: 'submission',
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Submission" />,
        cell: ({ row }) => {
            const { submissionType, isRetrained } = row.original
            return (
                <div className="flex justify-center">
                    <SubmissionBadge
                        submissionType={submissionType}
                        isRetrained={isRetrained}
                        badgeStyle="soft"
                        size="sm"
                    />
                </div>
            )
        },
        // Note: Custom sorting for submission type is likely not needed, but can be added here if required.
    })

    columns.push({
        id: 'actions',
        header: 'Actions',
        cell: ActionCell,
    })
    return columns
}
