import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/**
 * Loading skeleton for the benchmark list view.
 * Shows placeholder table rows for benchmarks while data is loading.
 * Optimized for minimal CLS with consistent spacing.
 */
export function BenchmarkListSkeleton() {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Targets</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell>
                            <Skeleton className="h-5 w-48" />
                        </TableCell>
                        <TableCell>
                            <Skeleton className="h-4 w-64" />
                        </TableCell>
                        <TableCell className="text-right">
                            <Skeleton className="ml-auto h-6 w-24 rounded-full" />
                        </TableCell>
                        <TableCell className="text-right">
                            <Skeleton className="ml-auto h-6 w-32 rounded-full" />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}

/**
 * Loading skeleton for the target grid view.
 * Shows placeholder target molecule cards while data is loading.
 */
export function TargetGridSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i}>
                    <CardHeader>
                        <Skeleton className="h-[200px] w-full" /> {/* Molecule structure */}
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Skeleton className="h-4 w-24" /> {/* Target ID */}
                        <div className="flex gap-2">
                            <Skeleton className="h-5 w-16 rounded-full" /> {/* Route length badge */}
                            <Skeleton className="h-5 w-20 rounded-full" /> {/* Convergent badge */}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

/**
 * Loading skeleton for benchmark detail header.
 * Matches exact layout to minimize CLS.
 */
export function BenchmarkDetailHeaderSkeleton() {
    return (
        <div className="space-y-4">
            {/* Back button */}
            <Skeleton className="h-9 w-40" />

            {/* Title and badges */}
            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-64" /> {/* Title */}
                    <Skeleton className="h-6 w-28 rounded-full" /> {/* Target count badge */}
                </div>
                {/* Description line */}
                <Skeleton className="h-4 w-full max-w-2xl" />
            </div>
        </div>
    )
}
