import Link from 'next/link'

import * as benchmarkView from '@/lib/services/view/benchmark.view'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/**
 * Server component that displays all available benchmarks with their target counts.
 * Each benchmark row is clickable and navigates to the benchmark detail page.
 */
export async function BenchmarkList() {
    const benchmarks = await benchmarkView.getBenchmarkSets()

    if (benchmarks.length === 0) {
        return (
            <div className="text-muted-foreground py-12 text-center">
                <p>No benchmarks available. Load a benchmark using the CLI script.</p>
            </div>
        )
    }

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
                {benchmarks.map((benchmark) => (
                    <TableRow key={benchmark.id} className="group hover:bg-muted/50 relative transition-colors">
                        <TableCell className="font-semibold">
                            <Link
                                href={`/benchmarks/${benchmark.id}`}
                                className="focus:ring-primary rounded-sm outline-none after:absolute after:inset-0 focus:ring-2"
                                prefetch={true}
                            >
                                {benchmark.name}
                            </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{benchmark.description || '—'}</TableCell>
                        <TableCell className="text-right">
                            <Badge variant="secondary">{benchmark.targetCount.toLocaleString()}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <Badge variant="outline">{benchmark.stock.name}</Badge>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
