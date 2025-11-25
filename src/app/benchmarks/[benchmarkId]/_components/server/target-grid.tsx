import Link from 'next/link'

import * as benchmarkService from '@/lib/services/benchmark.service'
import { SmileDrawerSvg } from '@/components/smile-drawer'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface TargetGridProps {
    benchmarkId: string
    page?: number
    limit?: number
}

/**
 * Server component that displays a grid of benchmark targets with molecule structures.
 * Shows pagination and target metadata (route length, convergence).
 */
export async function TargetGrid({ benchmarkId, page = 1, limit = 24 }: TargetGridProps) {
    const result = await benchmarkService.getBenchmarkTargets(benchmarkId, page, limit)

    if (result.targets.length === 0) {
        return (
            <Card>
                <CardContent className="text-muted-foreground py-8 text-center">
                    No targets found in this benchmark.
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            {/* Target grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {result.targets.map((target) => (
                    <Link key={target.id} href={`/benchmarks/${benchmarkId}/targets/${target.id}`} prefetch={true}>
                        <Card className="group hover:bg-accent transition-colors">
                            <CardHeader className="p-4">
                                <div className="flex items-center justify-center">
                                    <SmileDrawerSvg smilesStr={target.molecule.smiles} width={200} height={200} />
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2 px-4 pb-4">
                                <p className="font-mono text-sm font-medium">{target.targetId}</p>
                                <div className="flex flex-wrap gap-2">
                                    {target.routeLength !== null && (
                                        <Badge variant="secondary">Length: {target.routeLength}</Badge>
                                    )}
                                    {target.isConvergent !== null && (
                                        <Badge variant={target.isConvergent ? 'default' : 'outline'}>
                                            {target.isConvergent ? 'Convergent' : 'Linear'}
                                        </Badge>
                                    )}
                                    {target.hasGroundTruth && <Badge variant="secondary">Has GT</Badge>}
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Pagination info */}
            <div className="text-muted-foreground flex items-center justify-between text-sm">
                <p>
                    Showing {(page - 1) * limit + 1} - {Math.min(page * limit, result.total)} of {result.total} targets
                </p>
                <div className="flex gap-2">
                    {page > 1 && (
                        <Link
                            href={`/benchmarks/${benchmarkId}?page=${page - 1}`}
                            className="hover:underline"
                            prefetch={true}
                        >
                            ← Previous
                        </Link>
                    )}
                    {result.hasMore && (
                        <Link
                            href={`/benchmarks/${benchmarkId}?page=${page + 1}`}
                            className="hover:underline"
                            prefetch={true}
                        >
                            Next →
                        </Link>
                    )}
                </div>
            </div>
        </div>
    )
}
