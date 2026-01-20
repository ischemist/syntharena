'use client'

import Link from 'next/link'
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
        accessorKey: 'modelInstance',
        id: 'model',
        header: ({ column, table }) => <DataTableColumnHeader table={table} column={column} title="Model" />,
        cell: ({ row }) => {
            const run = row.original
            const family = run.modelInstance.family
            const algorithm = family.algorithm
            return (
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-baseline gap-2">
                        <Link href={`/families/${family.slug}`} className="font-medium hover:underline" prefetch={true}>
                            {family.name}
                        </Link>
                        <Link href={`/models/${run.modelInstance.slug}`} className="hover:underline" prefetch={true}>
                            <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                                {formatVersion(run.modelInstance)}
                            </code>
                        </Link>
                    </div>
                    <Link
                        href={`/algorithms/${algorithm.slug}`}
                        className="text-muted-foreground text-xs hover:underline"
                        prefetch={true}
                    >
                        {algorithm.name}
                    </Link>
                </div>
            )
        },
        sortingFn: (rowA, rowB) =>
            rowA.original.modelInstance.family.name.localeCompare(rowB.original.modelInstance.family.name),
    },
    {
        accessorKey: 'benchmarkSet.name',
        id: 'benchmark',
        header: ({ column, table }) => <DataTableColumnHeader table={table} column={column} title="Benchmark" />,
        cell: ({ row }) => {
            const run = row.original
            return (
                <Link href={`/benchmarks/${run.benchmarkSet.id}`} className="hover:underline" prefetch={true}>
                    {run.benchmarkSet.name}
                </Link>
            )
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
