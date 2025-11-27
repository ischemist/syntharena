import * as benchmarkService from '@/lib/services/benchmark.service'
import { Badge } from '@/components/ui/badge'
import { ClickableTableRow } from '@/components/ui/clickable-table-row'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/**
 * Server component that displays all available benchmarks with their target counts.
 * Each benchmark row is clickable and navigates to the benchmark detail page.
 */
export async function BenchmarkList() {
    const benchmarks = await benchmarkService.getBenchmarkSets()

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
                    <ClickableTableRow key={benchmark.id} href={`/benchmarks/${benchmark.id}`}>
                        <TableCell className="font-semibold">{benchmark.name}</TableCell>
                        <TableCell className="text-muted-foreground">{benchmark.description || '—'}</TableCell>
                        <TableCell className="text-right">
                            <Badge variant="secondary">{benchmark.targetCount.toLocaleString()}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            {benchmark.stockName ? (
                                <Badge variant="outline">{benchmark.stockName}</Badge>
                            ) : (
                                <span className="text-muted-foreground">—</span>
                            )}
                        </TableCell>
                    </ClickableTableRow>
                ))}
            </TableBody>
        </Table>
    )
}
