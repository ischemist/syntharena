'use client'

import { ColumnDef } from '@tanstack/react-table'

import type { LeaderboardEntry } from '@/types'
import { MetricCell } from '@/components/metrics'

import { DataTableColumnHeader } from './data-table-column-header'

/**
 * Creates column definitions for the overall leaderboard table.
 * Includes model name, solvability, and dynamic Top-K accuracy columns.
 *
 * @param displayedTopK - Filtered list of Top-K metrics to actually show (based on user selection)
 */
export function createLeaderboardColumns(displayedTopK: string[]): ColumnDef<LeaderboardEntry>[] {
    const columns: ColumnDef<LeaderboardEntry>[] = [
        // Model Name Column
        {
            accessorKey: 'modelName',
            id: 'modelName',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Model" />,
            cell: ({ row }) => <div className="font-medium">{row.getValue('modelName')}</div>,
        },
        // Solvability Column
        {
            accessorKey: 'metrics.solvability.value',
            id: 'solvability',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Solvability" className="justify-end" />
            ),
            cell: ({ row }) => {
                const metric = row.original.metrics.solvability
                const isLastColumn = displayedTopK.length === 0
                return (
                    <div className={isLastColumn ? 'pr-24 text-right' : 'text-right'}>
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
    displayedTopK.forEach((metricName, idx) => {
        const isLastColumn = idx === displayedTopK.length - 1

        columns.push({
            id: metricName,
            accessorFn: (row) => row.metrics.topKAccuracy?.[metricName]?.value,
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={metricName} className="justify-end" />
            ),
            cell: ({ row }) => {
                const metric = row.original.metrics.topKAccuracy?.[metricName]
                return (
                    <div className={isLastColumn ? 'pr-24 text-right' : 'text-right'}>
                        {metric ? <MetricCell metric={metric} showBadge /> : '-'}
                    </div>
                )
            },
            sortingFn: (rowA, rowB) => {
                const a = rowA.original.metrics.topKAccuracy?.[metricName]?.value ?? -1
                const b = rowB.original.metrics.topKAccuracy?.[metricName]?.value ?? -1
                return a - b
            },
        })
    })

    return columns
}
