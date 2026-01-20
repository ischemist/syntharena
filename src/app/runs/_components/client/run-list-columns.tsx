'use client'

import { ColumnDef } from '@tanstack/react-table'
import { formatDistanceToNow } from 'date-fns'

import type { PredictionRunWithStats } from '@/types'
import { SubmissionBadge } from '@/components/badges/submission'
import { DataTableColumnHeader } from '@/components/data-table-column-header'
import { MetricCell } from '@/components/metrics'
import { Badge } from '@/components/ui/badge'

function formatVersion(instance: PredictionRunWithStats['modelInstance']): string {
    const base = `v${instance.versionMajor}.${instance.versionMinor}.${instance.versionPatch}`
    return instance.versionPrerelease ? `${base}-${instance.versionPrerelease}` : base
}

export const columns: ColumnDef<PredictionRunWithStats>[] = [
    {
        accessorKey: 'modelInstance.family.name',
        id: 'modelFamily',
        header: ({ column, table }) => <DataTableColumnHeader table={table} column={column} title="Model Family" />,
        cell: ({ row }) => <span className="font-medium">{row.original.modelInstance.family.name}</span>,
    },
    {
        accessorKey: 'modelInstance.slug',
        id: 'version',
        header: ({ column, table }) => <DataTableColumnHeader table={table} column={column} title="Version" />,
        cell: ({ row }) => (
            <code className="bg-muted rounded px-1.5 py-0.5 text-sm">{formatVersion(row.original.modelInstance)}</code>
        ),
        sortingFn: (rowA, rowB) => {
            const a = rowA.original.modelInstance
            const b = rowB.original.modelInstance
            if (a.versionMajor !== b.versionMajor) return a.versionMajor - b.versionMajor
            if (a.versionMinor !== b.versionMinor) return a.versionMinor - b.versionMinor
            if (a.versionPatch !== b.versionPatch) return a.versionPatch - b.versionPatch
            return (a.versionPrerelease ?? '').localeCompare(b.versionPrerelease ?? '')
        },
    },
    {
        accessorKey: 'top1Accuracy.value',
        id: 'top1',
        header: ({ column, table }) => <DataTableColumnHeader table={table} column={column} title="Top-1" />,
        cell: ({ row }) => {
            const metric = row.original.top1Accuracy
            return metric ? <MetricCell metric={metric} /> : <span className="text-muted-foreground">—</span>
        },
    },
    {
        accessorKey: 'top10Accuracy.value',
        id: 'top10',
        header: ({ column, table }) => <DataTableColumnHeader table={table} column={column} title="Top-10" />,
        cell: ({ row }) => {
            const metric = row.original.top10Accuracy
            return metric ? <MetricCell metric={metric} /> : <span className="text-muted-foreground">—</span>
        },
    },
    {
        accessorKey: 'totalRoutes',
        id: 'routes',
        header: ({ column, table }) => <DataTableColumnHeader table={table} column={column} title="Routes" />,
        cell: ({ row }) => (
            <Badge variant="secondary" className="font-mono">
                {row.original.totalRoutes.toLocaleString()}
            </Badge>
        ),
    },
    {
        accessorKey: 'totalWallTime',
        id: 'duration',
        header: ({ column, table }) => <DataTableColumnHeader table={table} column={column} title="Duration" />,
        cell: ({ row }) => {
            const wallTime = row.original.totalWallTime
            return wallTime ? (
                <span className="text-muted-foreground text-sm">{(wallTime / 60).toFixed(1)} min</span>
            ) : (
                <span className="text-muted-foreground">—</span>
            )
        },
    },
    {
        accessorKey: 'executedAt',
        id: 'executed',
        header: ({ column, table }) => <DataTableColumnHeader table={table} column={column} title="Executed" />,
        cell: ({ row }) => (
            <span className="text-muted-foreground text-sm">
                {formatDistanceToNow(new Date(row.original.executedAt), { addSuffix: true })}
            </span>
        ),
    },
    {
        accessorKey: 'submissionType',
        id: 'submission',
        header: ({ column, table }) => <DataTableColumnHeader table={table} column={column} title="Submission" />,
        cell: ({ row }) => (
            <SubmissionBadge
                submissionType={row.original.submissionType}
                isRetrained={row.original.isRetrained}
                size="sm"
                badgeStyle="soft"
            />
        ),
    },
]
