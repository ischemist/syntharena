import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function RunListSkeleton() {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <TableHead key={i}>
                            <Skeleton className="h-5 w-24" />
                        </TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell>
                            <div className="space-y-1.5">
                                <Skeleton className="h-4 w-48" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                        </TableCell>
                        <TableCell>
                            <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                            <Skeleton className="h-6 w-20 rounded" />
                        </TableCell>
                        <TableCell>
                            <Skeleton className="h-6 w-20 rounded" />
                        </TableCell>
                        <TableCell>
                            <Skeleton className="h-6 w-20 rounded-full" />
                        </TableCell>
                        <TableCell>
                            <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                            <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                            <Skeleton className="h-6 w-24 rounded-full" />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
