import Link from 'next/link'

import * as algorithmView from '@/lib/services/view/algorithm.view'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/**
 * Server component that fetches and displays all algorithms in a table.
 */
export async function AlgorithmList() {
    const algorithms = await algorithmView.getAlgorithmListItems()

    if (algorithms.length === 0) {
        return (
            <div className="text-muted-foreground py-12 text-center">
                <p>No algorithms found. Load prediction data using the CLI.</p>
            </div>
        )
    }

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
                {algorithms.map((algorithm) => (
                    <TableRow key={algorithm.id} className="group hover:bg-muted/50 relative transition-colors">
                        <TableCell className="font-semibold">
                            <Link
                                href={`/algorithms/${algorithm.slug}`}
                                className="focus:ring-primary rounded-sm outline-none after:absolute after:inset-0 focus:ring-2"
                                prefetch={true}
                            >
                                {algorithm.name}
                            </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-md truncate">
                            {algorithm.description || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                            <Badge variant="secondary">
                                {algorithm.instanceCount} {algorithm.instanceCount === 1 ? 'version' : 'versions'}
                            </Badge>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
