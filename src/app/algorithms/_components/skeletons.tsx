import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/**
 * Loading skeleton for the algorithm list table.
 * Shows placeholder rows while algorithms are loading.
 */
export function AlgorithmListSkeleton() {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Versions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell>
                            <Skeleton className="h-5 w-40" />
                        </TableCell>
                        <TableCell>
                            <Skeleton className="h-4 w-64" />
                        </TableCell>
                        <TableCell className="text-right">
                            <Skeleton className="ml-auto h-6 w-24 rounded-full" />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
