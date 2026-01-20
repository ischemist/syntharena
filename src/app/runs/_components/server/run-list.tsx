'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { flexRender, getCoreRowModel, getSortedRowModel, SortingState, useReactTable } from '@tanstack/react-table'

import type { PredictionRunWithStats } from '@/types'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'

import { columns } from '../client/run-list-columns'

export function RunDataTable({ runs }: { runs: PredictionRunWithStats[] }) {
    const router = useRouter()
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
                    <TableRow
                        key={row.id}
                        className="group relative cursor-pointer"
                        onClick={() => router.push(`/runs/${row.original.id}`)}
                    >
                        {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
