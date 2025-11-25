import Link from 'next/link'

import * as benchmarkService from '@/lib/services/benchmark.service'
import { RouteLengthBadge, RouteTypeBadge } from '@/components/route-badges'
import { SmileDrawerSvg } from '@/components/smile-drawer'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

import { TargetPagination } from '../client/target-pagination'

interface TargetGridProps {
    benchmarkId: string
    page?: number
    limit?: number
    searchQuery?: string
    searchType?: 'smiles' | 'inchikey' | 'targetId' | 'all'
    isConvergent?: boolean
    minRouteLength?: number
    maxRouteLength?: number
}

/**
 * Server component that displays a grid of benchmark targets with molecule structures.
 * Shows pagination and target metadata (route length, convergence).
 * Supports search and filtering by SMILES/InChiKey/TargetId and convergence/length.
 */
export async function TargetGrid({
    benchmarkId,
    page = 1,
    limit = 24,
    searchQuery,
    searchType = 'all',
    isConvergent,
    minRouteLength,
    maxRouteLength,
}: TargetGridProps) {
    const result = await benchmarkService.getBenchmarkTargets(
        benchmarkId,
        page,
        limit,
        searchQuery,
        searchType,
        undefined, // hasGroundTruth filter (not used here)
        minRouteLength,
        maxRouteLength,
        isConvergent
    )

    if (result.targets.length === 0) {
        return (
            <Card variant="bordered">
                <CardContent className="text-muted-foreground py-8 text-center">
                    No targets found in this benchmark.
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
                                            <RouteLengthBadge length={target.routeLength} variant="ghost" />
                                        )}
                                        {target.isConvergent !== null && (
                                            <RouteTypeBadge isConvergent={target.isConvergent} variant="ghost" />
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
                currentPage={page}
                totalPages={Math.ceil(result.total / limit)}
                totalItems={result.total}
                itemsPerPage={limit}
            />
        </div>
    )
}
