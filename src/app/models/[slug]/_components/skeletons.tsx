import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/**
 * Loading skeleton for the model instance detail header.
 * Matches layout of ModelDetailHeader to minimize CLS.
 */
export function ModelDetailHeaderSkeleton() {
    return (
        <div className="space-y-4">
            {/* Back link */}
            <Skeleton className="h-5 w-40" />

            {/* Title row with version badge */}
            <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-6 w-20 rounded" />
            </div>

            {/* Description */}
            <Skeleton className="h-5 w-full max-w-xl" />

            {/* Algorithm link */}
            <Skeleton className="h-5 w-32" />
        </div>
    )
}

/**
 * Loading skeleton for the executive summary section.
 * Shows placeholder cards for summary statistics.
 */
export function ExecutiveSummarySkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-7 w-44" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="border-border space-y-3 rounded-lg border p-4">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-3 w-full" />
                    </div>
                ))}
            </div>
        </div>
    )
}

/**
 * Loading skeleton for the performance chart.
 * Shows placeholder for chart visualization.
 */
export function PerformanceChartSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-7 w-80" />
            <div className="border-border rounded-lg border p-6">
                <Skeleton className="h-[300px] w-full" />
            </div>
        </div>
    )
}

/**
 * Loading skeleton for the prediction run table.
 * Shows placeholder rows while runs are loading.
 */
export function PredictionRunTableSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-7 w-36" />
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Benchmark</TableHead>
                        <TableHead className="text-right">Routes</TableHead>
                        <TableHead className="text-right">Duration</TableHead>
                        <TableHead className="text-right">Executed</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell>
                                <Skeleton className="h-5 w-40" />
                            </TableCell>
                            <TableCell className="text-right">
                                <Skeleton className="ml-auto h-6 w-20 rounded-full" />
                            </TableCell>
                            <TableCell className="text-right">
                                <Skeleton className="ml-auto h-4 w-16" />
                            </TableCell>
                            <TableCell className="text-right">
                                <Skeleton className="ml-auto h-4 w-24" />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

/**
 * Combined skeleton for the full model detail page.
 */
export function ModelDetailSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <ModelDetailHeaderSkeleton />
            <ExecutiveSummarySkeleton />
            <PerformanceChartSkeleton />
            <PredictionRunTableSkeleton />
        </div>
    )
}
