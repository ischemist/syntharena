import Link from 'next/link'

import type { BenchmarkListItem } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function BenchmarkList({ benchmarks }: { benchmarks: BenchmarkListItem[] }) {
    if (benchmarks.length === 0) {
        return (
            <div className="text-muted-foreground py-12 text-center">
                <p>No benchmarks found in this series.</p>
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
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
