'use client'

import { usePathname, useSearchParams } from 'next/navigation'

import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination'

interface TargetPaginationProps {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
}

/**
 * Client component for pagination controls using shadcn/ui Pagination.
 * Updates URL search params to trigger server-side re-render with Next.js Link integration and prefetching.
 */
export function TargetPagination({ currentPage, totalPages, totalItems, itemsPerPage }: TargetPaginationProps) {
    const pathname = usePathname()
    const searchParams = useSearchParams()

    if (totalPages <= 1) {
        return null
    }

    const getPageUrl = (pageNum: number) => {
        const params = new URLSearchParams(searchParams)

        // Update page parameter
        if (pageNum === 1) {
            params.delete('page')
        } else {
            params.set('page', pageNum.toString())
        }

        // Build URL preserving all other search params
        const query = params.toString()
        return query ? `${pathname}?${query}` : pathname
    }

    const startItem = (currentPage - 1) * itemsPerPage + 1
    const endItem = Math.min(currentPage * itemsPerPage, totalItems)

    // Calculate visible page numbers
    const getVisiblePages = () => {
        const pages: (number | string)[] = []

        if (totalPages <= 7) {
            // Show all pages if 7 or fewer
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i)
            }
        } else {
            // Show first page
            pages.push(1)

            // Determine range around current page
            const rangeStart = Math.max(2, currentPage - 1)
            const rangeEnd = Math.min(totalPages - 1, currentPage + 1)

            // Add ellipsis if needed before range
            if (rangeStart > 2) {
                pages.push('ellipsis-1')
            }

            // Add page range
            for (let i = rangeStart; i <= rangeEnd; i++) {
                pages.push(i)
            }

            // Add ellipsis if needed after range
            if (rangeEnd < totalPages - 1) {
                pages.push('ellipsis-2')
            }

            // Add last page
            pages.push(totalPages)
        }

        return pages
    }

    const visiblePages = getVisiblePages()

    return (
        <div className="flex flex-col items-center gap-4">
            <Pagination>
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            href={getPageUrl(currentPage - 1)}
                            className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                    </PaginationItem>

                    {visiblePages.map((page) => {
                        if (typeof page === 'string') {
                            return (
                                <PaginationItem key={page}>
                                    <PaginationEllipsis />
                                </PaginationItem>
                            )
                        }

                        return (
                            <PaginationItem key={page}>
                                <PaginationLink href={getPageUrl(page)} isActive={page === currentPage}>
                                    {page}
                                </PaginationLink>
                            </PaginationItem>
                        )
                    })}

                    <PaginationItem>
                        <PaginationNext
                            href={getPageUrl(currentPage + 1)}
                            className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>

            <div className="text-muted-foreground text-sm">
                Showing {startItem.toLocaleString()}-{endItem.toLocaleString()} of {totalItems.toLocaleString()}
            </div>
        </div>
    )
}
