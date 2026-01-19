import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/**
 * Loading skeleton for the algorithm detail header.
 * Matches layout of AlgorithmDetailHeader to minimize CLS.
 */
export function AlgorithmDetailHeaderSkeleton() {
    return (
        <div className="space-y-6">
            {/* Back link */}
            <Skeleton className="h-5 w-32" />

            {/* Title and description */}
            <div className="space-y-2">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-5 w-full max-w-2xl" />
                <Skeleton className="h-5 w-3/4 max-w-xl" />
            </div>

            {/* External links */}
            <div className="flex gap-3">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-28" />
            </div>

            {/* Bibtex block */}
            <Card>
                <CardHeader className="pb-2">
                    <Skeleton className="h-5 w-20" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-24 w-full" />
                </CardContent>
            </Card>
        </div>
    )
}

/**
 * Loading skeleton for the model instance table.
 * Shows placeholder rows while instances are loading.
 */
export function ModelInstanceTableSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-7 w-40" />
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Runs</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell>
                                <Skeleton className="h-5 w-36" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-5 w-20" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-48" />
                            </TableCell>
                            <TableCell className="text-right">
                                <Skeleton className="ml-auto h-6 w-12 rounded-full" />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

/**
 * Combined skeleton for the full algorithm detail page.
 */
export function AlgorithmDetailSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <AlgorithmDetailHeaderSkeleton />
            <ModelInstanceTableSkeleton />
        </div>
    )
}
