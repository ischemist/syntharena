'use client'

import type { ComponentProps, KeyboardEvent, MouseEvent } from 'react'
import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'

import { TableRow } from './table'

type ClickableTableRowProps = ComponentProps<typeof TableRow> & {
    href: string
}

/**
 * A clickable table row that navigates to a URL when clicked.
 * Uses client-side navigation with keyboard accessibility.
 * This is a small, focused client component following the server-first architecture.
 */
export function ClickableTableRow({ href, children, className, ...props }: ClickableTableRowProps) {
    const router = useRouter()

    const handleClick = (e: MouseEvent<HTMLTableRowElement>) => {
        // Allow cmd/ctrl + click to open in new tab
        if (e.metaKey || e.ctrlKey) {
            window.open(href, '_blank')
            return
        }
        router.push(href)
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            router.push(href)
        }
    }

    return (
        <TableRow
            {...props}
            className={cn('cursor-pointer', className)}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="button"
        >
            {children}
        </TableRow>
    )
}
