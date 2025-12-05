import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function StatsTableSkeleton() {
    return (
        <section className="py-8">
            <h2 className="mb-4 text-2xl font-semibold">Platform Statistics</h2>
            <div className="grid gap-6 md:grid-cols-2">
                <div>
                    <h3 className="mb-2 text-sm font-medium">Models & Predictions</h3>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Metric</TableHead>
                                <TableHead className="text-right">Count</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell>
                                        <Skeleton className="h-4 w-32" />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Skeleton className="ml-auto h-4 w-16" />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <div>
                    <h3 className="mb-2 text-sm font-medium">Stock Molecules</h3>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Stock</TableHead>
                                <TableHead className="text-right">Molecules</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell>
                                        <Skeleton className="h-4 w-24" />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Skeleton className="ml-auto h-4 w-16" />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </section>
    )
}

export function BenchmarksTableSkeleton() {
    return (
        <section className="py-8">
            <h2 className="mb-4 text-2xl font-semibold">Benchmark Series</h2>
            <div className="grid gap-8 md:grid-cols-2">
                {Array.from({ length: 2 }).map((_, seriesIdx) => (
                    <div key={seriesIdx}>
                        <div className="mb-3">
                            <Skeleton className="mb-2 h-6 w-48" />
                            <Skeleton className="h-4 w-full" />
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Benchmark</TableHead>
                                    <TableHead className="text-right">Targets</TableHead>
                                    <TableHead className="text-right">Runs</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell>
                                            <Skeleton className="h-4 w-32" />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Skeleton className="ml-auto h-4 w-12" />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Skeleton className="ml-auto h-4 w-8" />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ))}
            </div>
        </section>
    )
}
