'use client'

import { Column } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type DataTableColumnHeaderProps<TData, TValue> = {
    column: Column<TData, TValue>
    title: string
    className?: string
}

/**
 * Reusable sortable column header component for TanStack Table.
 * Displays sort indicators and handles click to toggle sorting.
 * When actively sorted, shows single directional arrow and visual highlight.
 */
export function DataTableColumnHeader<TData, TValue>({
    column,
    title,
    className,
}: DataTableColumnHeaderProps<TData, TValue>) {
    if (!column.getCanSort()) {
        return <div className={cn(className)}>{title}</div>
    }

    const sorted = column.getIsSorted()
    const isSorted = sorted !== false

    return (
        <div className={cn('flex items-center justify-center', className)}>
            <Button
                variant="ghost"
                size="sm"
                className={cn('hover:bg-accent/50 h-8', isSorted && 'bg-accent/80 hover:bg-accent font-semibold')}
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
                <span>{title}</span>
                {sorted === 'desc' ? (
                    <ArrowDown className="ml-2 h-4 w-4" />
                ) : sorted === 'asc' ? (
                    <ArrowUp className="ml-2 h-4 w-4" />
                ) : (
                    <ArrowUpDown className="text-muted-foreground ml-2 h-4 w-4 opacity-50" />
                )}
            </Button>
        </div>
    )
}
