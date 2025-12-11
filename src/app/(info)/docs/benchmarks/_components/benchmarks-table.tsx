import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Benchmark = {
    name: string
    series: 'Market' | 'Reference'
    targets: number
    description: string
    stock: string
}

const BENCHMARKS: Benchmark[] = [
    // Market Series
    {
        name: 'mkt-lin-500',
        series: 'Market',
        targets: 500,
        description: 'Linear routes of lengths 2–6 (100 each)',
        stock: 'buyables-stock',
    },
    {
        name: 'mkt-cnv-160',
        series: 'Market',
        targets: 160,
        description: 'Convergent routes of depths 2–5 (40 each)',
        stock: 'buyables-stock',
    },
    // Reference Series
    {
        name: 'ref-lin-600',
        series: 'Reference',
        targets: 600,
        description: 'Linear routes of lengths 2–7 (100 each)',
        stock: 'n5-stock',
    },
    {
        name: 'ref-cnv-400',
        series: 'Reference',
        targets: 400,
        description: 'Convergent routes of depths 2–5 (100 each)',
        stock: 'n5-stock',
    },
    {
        name: 'ref-lng-84',
        series: 'Reference',
        targets: 84,
        description: 'All available routes with length 8–10 from n1 and n5',
        stock: 'n1-n5-stock',
    },
]

function getSeriesBadge(series: Benchmark['series']) {
    if (series === 'Market') {
        return (
            <Badge variant="default" className="text-xs">
                mkt
            </Badge>
        )
    }
    return (
        <Badge variant="secondary" className="text-xs">
            ref
        </Badge>
    )
}

export function BenchmarksTable() {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Benchmark</TableHead>
                        <TableHead>Series</TableHead>
                        <TableHead className="text-right">Targets</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Stock</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {BENCHMARKS.map((benchmark) => (
                        <TableRow key={benchmark.name}>
                            <TableCell className="font-mono text-sm font-medium">{benchmark.name}</TableCell>
                            <TableCell>{getSeriesBadge(benchmark.series)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{benchmark.targets}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{benchmark.description}</TableCell>
                            <TableCell className="font-mono text-xs">{benchmark.stock}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
