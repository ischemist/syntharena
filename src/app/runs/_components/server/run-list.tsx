'use client'

import { useState } from 'react'
import Link from 'next/link'
import { flexRender, getCoreRowModel, getSortedRowModel, SortingState, useReactTable } from '@tanstack/react-table'

import type { PredictionRunWithStats } from '@/types'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'

import { columns } from '../client/run-list-columns'

export function RunList({ runs }: { runs: PredictionRunWithStats[] }) {
    const [sorting, setSorting] = useState<SortingState>([{ id: 'executed', desc: true }])

    const table = useReactTable({
        data: runs,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    })

    return (
        <Table>
            <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                            <TableCell key={header.id} className="p-2">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                            </TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableHeader>
            <TableBody>
                {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="group relative">
                        {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className="p-4">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                        ))}
                        <Link
                            href={`/runs/${row.original.id}`}
                            className="focus:ring-primary rounded-sm outline-none after:absolute after:inset-0 focus:ring-2"
                            prefetch={true}
                        />
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
