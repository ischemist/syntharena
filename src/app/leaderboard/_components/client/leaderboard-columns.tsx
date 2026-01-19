'use client'

import Link from 'next/link'
import { ColumnDef } from '@tanstack/react-table'
import { Check, X } from 'lucide-react'

import type { LeaderboardEntry } from '@/types'
import { SubmissionBadge } from '@/components/badges/submission'
import { MetricCell } from '@/components/metrics'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

import { DataTableColumnHeader } from './data-table-column-header'

/**
 * Creates column definitions for the overall leaderboard table.
 * Includes model name, solvability, and dynamic Top-K accuracy columns.
 *
 * @param displayedTopK - Filtered list of Top-K metrics to actually show (based on user selection)
 */
export function createLeaderboardColumns(
    benchmarkSeries: LeaderboardEntry['benchmarkSeries'],
    displayedTopK: string[]
): ColumnDef<LeaderboardEntry>[] {
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
        // Solvability Column
        {
            accessorKey: 'metrics.solvability.value',
            id: 'solvability',
            header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Solvability" />,
            cell: ({ row }) => {
                const metric = row.original.metrics.solvability
                return (
                    <div className="flex justify-center">
                        <MetricCell metric={metric} showBadge />
                    </div>
                )
            },
            sortingFn: (rowA, rowB) => {
                const a = rowA.original.metrics.solvability.value
                const b = rowB.original.metrics.solvability.value
                return a - b
            },
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

    return columns
}
