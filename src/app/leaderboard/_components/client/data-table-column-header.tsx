'use client'

import { Column, Table } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type DataTableColumnHeaderProps<TData, TValue> = {
    column: Column<TData, TValue>
    table: Table<TData>
    title: string
    className?: string
}

export function DataTableColumnHeader<TData, TValue>({
    column,
    table,
    title,
    className,
}: DataTableColumnHeaderProps<TData, TValue>) {
    // 1. Get the global sorting state directly from the table
    // This bypasses any stale column reference issues
    const sortingState = table.getState().sorting

    // 2. Check if THIS column is in the sorting state
    const sortEntry = sortingState.find((s) => s.id === column.id)
    const isSorted = sortEntry ? (sortEntry.desc ? 'desc' : 'asc') : false

    if (!column.getCanSort()) {
        return <div className={cn(className)}>{title}</div>
    }

    return (
        <div className={cn('flex items-center justify-center', className)}>
            <Button
                variant="ghost"
                size="sm"
                className={cn('hover:bg-accent/50 h-8', isSorted && 'bg-accent/80 hover:bg-accent font-semibold')}
                onClick={() => {
                    // Force the logic:
                    // If currently Descending -> go Ascending
                    // Anything else (Unsorted or Ascending) -> go Descending
                    if (isSorted === 'desc') {
                        column.toggleSorting(false) // false = ASC
                    } else {
                        column.toggleSorting(true) // true = DESC
                    }
                }}
            >
                <span>{title}</span>
                {isSorted === 'desc' ? (
                    <ArrowDown className="ml-2 h-4 w-4" />
                ) : isSorted === 'asc' ? (
                    <ArrowUp className="ml-2 h-4 w-4" />
                ) : (
                    <ArrowUpDown className="text-muted-foreground ml-2 h-4 w-4 opacity-50" />
                )}
            </Button>
        </div>
    )
}
