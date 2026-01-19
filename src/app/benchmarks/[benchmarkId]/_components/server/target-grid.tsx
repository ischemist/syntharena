import Link from 'next/link'

import type { BenchmarkTargetSearchResult } from '@/types'
import { RouteLengthBadge, RouteTypeBadge } from '@/components/badges/route'
import { SmileDrawerSvg } from '@/components/smile-drawer'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

import { TargetPagination } from '../client/target-pagination'

interface TargetGridProps {
    benchmarkId: string
    result: BenchmarkTargetSearchResult
}

/**
 * Synchronous component that displays a grid of benchmark targets from a pre-fetched result set.
 */
export function TargetGrid({ benchmarkId, result }: TargetGridProps) {
    if (result.targets.length === 0) {
        return (
            <Card variant="bordered">
                <CardContent className="text-muted-foreground py-8 text-center">
                    No targets match the current filters.
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            {/* Target grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {result.targets.map((target) => (
                    <Link key={target.id} href={`/benchmarks/${benchmarkId}/targets/${target.id}`} prefetch={true}>
                        <Card variant="bordered" className="group hover:bg-accent/50 transition-colors">
                            <CardHeader className="px-4 pb-0">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate font-mono text-sm font-medium">{target.targetId}</span>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                        {target.routeLength !== null && (
                                            <RouteLengthBadge length={target.routeLength} badgeStyle="soft" />
                                        )}
                                        {target.isConvergent !== null && (
                                            <RouteTypeBadge
                                                isConvergent={target.isConvergent}
                                                badgeStyle="soft"
                                                size="sm"
                                            />
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-center">
                                    <SmileDrawerSvg smilesStr={target.molecule.smiles} width={200} height={200} />
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Pagination component */}
            <TargetPagination
                currentPage={result.page}
                totalPages={Math.ceil(result.total / result.limit)}
                totalItems={result.total}
                itemsPerPage={result.limit}
            />
        </div>
    )
}
