import Link from 'next/link'

import { getTargetsByRun } from '@/lib/services/prediction.service'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination'

type TargetGridProps = {
    runId: string
    searchParams: Promise<{
        stock?: string
        gtStatus?: string
        length?: string
        solvable?: string
        page?: string
    }>
}

export async function TargetGrid({ runId, searchParams }: TargetGridProps) {
    const params = await searchParams
    const page = parseInt(params.page || '1', 10)
    const pageSize = 50

    const filters = {
        hasGroundTruth: params.gtStatus === 'has-gt' ? true : undefined,
        routeLength: params.length ? parseInt(params.length, 10) : undefined,
        isSolvable: params.solvable === 'solved' ? true : params.solvable === 'unsolved' ? false : undefined,
    }

    const result = await getTargetsByRun(runId, {
        ...filters,
        page,
        limit: pageSize,
    })

    if (result.targets.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground">No targets found for this run.</p>
                </CardContent>
            </Card>
        )
    }

    const totalPages = Math.ceil(result.total / pageSize)

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {result.targets.map((target) => (
                    <Link key={target.id} href={`/runs/${runId}/targets/${target.id}`}>
                        <Card className="hover:bg-muted/50 h-full transition-colors">
                            <CardHeader>
                                <CardTitle className="font-mono text-sm">{target.targetId}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="text-muted-foreground truncate text-xs">{target.molecule.smiles}</div>
                                <div className="flex items-center gap-2">
                                    {target.routeCount && target.routeCount > 0 ? (
                                        <Badge variant="secondary">{target.routeCount} routes</Badge>
                                    ) : (
                                        <Badge variant="outline">No routes</Badge>
                                    )}
                                </div>
                                {target.routeLength && (
                                    <div className="text-muted-foreground text-xs">Length: {target.routeLength}</div>
                                )}
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            {totalPages > 1 && (
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious href={page > 1 ? `?page=${page - 1}` : '#'} aria-disabled={page <= 1} />
                        </PaginationItem>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const pageNum = i + 1
                            return (
                                <PaginationItem key={pageNum}>
                                    <PaginationLink href={`?page=${pageNum}`} isActive={page === pageNum}>
                                        {pageNum}
                                    </PaginationLink>
                                </PaginationItem>
                            )
                        })}
                        {totalPages > 5 && <PaginationEllipsis />}
                        <PaginationItem>
                            <PaginationNext
                                href={page < totalPages ? `?page=${page + 1}` : '#'}
                                aria-disabled={page >= totalPages}
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            )}
        </div>
    )
}
