'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface MoleculePaginationProps {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
}

/**
 * Client component for pagination controls.
 * Updates URL search params to trigger server-side re-render.
 */
export function MoleculePagination({ currentPage, totalPages, totalItems, itemsPerPage }: MoleculePaginationProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams)

        if (newPage === 1) {
            params.delete('page')
        } else {
            params.set('page', newPage.toString())
        }

        startTransition(() => {
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        })
    }

    if (totalPages <= 1) {
        return null
    }

    const startItem = (currentPage - 1) * itemsPerPage + 1
    const endItem = Math.min(currentPage * itemsPerPage, totalItems)

    return (
        <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-sm">
                Showing {startItem.toLocaleString()}-{endItem.toLocaleString()} of {totalItems.toLocaleString()}
            </div>

            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || isPending}
                >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                </Button>

                <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number

                        if (totalPages <= 5) {
                            pageNum = i + 1
                        } else if (currentPage <= 3) {
                            pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i
                        } else {
                            pageNum = currentPage - 2 + i
                        }

                        return (
                            <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handlePageChange(pageNum)}
                                disabled={isPending}
                                className="min-w-9"
                            >
                                {pageNum}
                            </Button>
                        )
                    })}
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || isPending}
                >
                    Next
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}
