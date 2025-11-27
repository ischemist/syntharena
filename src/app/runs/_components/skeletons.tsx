import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function RunListSkeleton() {
    return (
        <div className="space-y-8">
            {/* Show 2 grouped tables */}
            {Array.from({ length: 2 }).map((_, benchmarkIdx) => (
                <div key={benchmarkIdx} className="space-y-3">
                    <Skeleton className="h-7 w-48" /> {/* Benchmark name */}
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Model</TableHead>
                                <TableHead className="text-right">Routes</TableHead>
                                <TableHead className="text-right">Duration</TableHead>
                                <TableHead className="text-right">Executed</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell>
                                        <Skeleton className="h-5 w-40" />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Skeleton className="ml-auto h-6 w-24 rounded-full" />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Skeleton className="ml-auto h-4 w-20" />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Skeleton className="ml-auto h-4 w-24" />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ))}
        </div>
    )
}
