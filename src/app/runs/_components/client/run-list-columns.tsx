'use client'

import { ColumnDef } from '@tanstack/react-table'
import { formatDistanceToNow } from 'date-fns'

import type { PredictionRunWithStats } from '@/types'
import { compareVersions, formatVersion } from '@/lib/utils'
import { SubmissionBadge } from '@/components/badges/submission'
import { DataTableColumnHeader } from '@/components/data-table-column-header'
import { MetricCell } from '@/components/metrics'
import { Badge } from '@/components/ui/badge'

export const columns: ColumnDef<PredictionRunWithStats>[] = [
    {
        accessorKey: 'modelInstance.family.name',
        id: 'modelFamily',
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Model Family" />,
        cell: ({ row }) => <span className="font-medium">{row.original.modelInstance.family.name}</span>,
    },
    {
        accessorKey: 'modelInstance.slug',
        id: 'version',
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Version" />,
        cell: ({ row }) => (
            <div className="flex justify-center">
                <code className="bg-muted rounded px-1.5 py-0.5 text-sm">
                    {formatVersion(row.original.modelInstance)}
                </code>
            </div>
        ),
        sortingFn: (rowA, rowB) => compareVersions(rowA.original.modelInstance, rowB.original.modelInstance),
    },
    {
        accessorKey: 'top1Accuracy.value',
        id: 'top1',
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Top-1" />,
        cell: ({ row }) => (
            <div className="flex justify-center">
                {row.original.top1Accuracy ? (
                    <MetricCell metric={row.original.top1Accuracy} />
                ) : (
                    <span className="text-muted-foreground">—</span>
                )}
            </div>
        ),
    },
    {
        accessorKey: 'top10Accuracy.value',
        id: 'top10',
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Top-10" />,
        cell: ({ row }) => (
            <div className="flex justify-center">
                {row.original.top10Accuracy ? (
                    <MetricCell metric={row.original.top10Accuracy} />
                ) : (
                    <span className="text-muted-foreground">—</span>
                )}
            </div>
        ),
    },
    {
        accessorKey: 'totalRoutes',
        id: 'routes',
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Routes" />,
        cell: ({ row }) => (
            <div className="flex justify-center">
                <Badge variant="secondary" className="font-mono">
                    {row.original.totalRoutes.toLocaleString()}
                </Badge>
            </div>
        ),
    },
    {
        accessorKey: 'totalWallTime',
        id: 'duration',
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Duration" />,
        cell: ({ row }) => (
            <div className="flex justify-center">
                {row.original.totalWallTime ? (
                    <span className="text-muted-foreground text-sm">
                        {(row.original.totalWallTime / 60).toFixed(1)} min
                    </span>
                ) : (
                    <span className="text-muted-foreground">—</span>
                )}
            </div>
        ),
    },
    {
        accessorKey: 'totalCost',
        id: 'cost',
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Cost" />,
        cell: ({ row }) => (
            <div className="flex justify-center">
                {row.original.totalCost != null ? (
                    <span className="text-muted-foreground font-mono text-sm">
                        ${row.original.totalCost.toFixed(2)}
                    </span>
                ) : (
                    <span className="text-muted-foreground">—</span>
                )}
            </div>
        ),
    },
    {
        accessorKey: 'executedAt',
        id: 'executed',
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Executed" />,
        cell: ({ row }) => (
            <div className="flex justify-center">
                <span className="text-muted-foreground text-sm">
                    {formatDistanceToNow(new Date(row.original.executedAt), { addSuffix: true })}
                </span>
            </div>
        ),
    },
    {
        accessorKey: 'submissionType',
        id: 'submission',
        header: ({ column, table }) => <DataTableColumnHeader column={column} table={table} title="Submission" />,
        cell: ({ row }) => (
            <div className="flex justify-center">
                <SubmissionBadge
                    submissionType={row.original.submissionType}
                    isRetrained={row.original.isRetrained}
                    size="sm"
                    badgeStyle="soft"
                />
            </div>
        ),
    },
]
