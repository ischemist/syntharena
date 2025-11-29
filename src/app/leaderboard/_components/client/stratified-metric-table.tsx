'use client'

import { useMemo, useState } from 'react'
import { flexRender, getCoreRowModel, getSortedRowModel, SortingState, useReactTable } from '@tanstack/react-table'

import type { StratifiedMetric } from '@/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { createStratifiedColumns, transformStratifiedData } from './stratified-columns'

type StratifiedMetricTableProps = {
    metricName: string
    metricsMap: Map<
        string,
        {
            solvability: StratifiedMetric
            topKAccuracy?: Record<string, StratifiedMetric>
        }
    >
    routeLengths: number[]
    showTitle?: boolean
}

/**
 * Client component for rendering a single stratified metric table with TanStack Table sorting.
 * Can optionally show a title above the table.
 */
export function StratifiedMetricTable({
    metricName,
    metricsMap,
    routeLengths,
    showTitle = true,
}: StratifiedMetricTableProps) {
    const [sorting, setSorting] = useState<SortingState>([])

    // Transform data for TanStack Table
    const data = useMemo(() => transformStratifiedData(metricsMap, metricName), [metricsMap, metricName])

    // Create columns
    const columns = useMemo(() => createStratifiedColumns(routeLengths), [routeLengths])

    // Initialize TanStack Table
    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    })

    const displayTitle =
        metricName === 'Solvability' ? 'Solvability by Route Length' : `${metricName} Accuracy by Route Length`

    return (
        <div>
            {showTitle && <h4 className="text-muted-foreground mb-3 text-sm font-medium">{displayTitle}</h4>}
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead
                                        key={header.id}
                                        className={header.id === 'modelName' ? '' : 'min-w-[220px]'}
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
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
            </div>
        </div>
    )
}
