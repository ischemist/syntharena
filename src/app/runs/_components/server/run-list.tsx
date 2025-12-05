import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

import { getPredictionRuns } from '@/lib/services/prediction.service'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type RunListProps = {
    searchParams: Promise<{
        benchmark?: string
        model?: string
        page?: string
    }>
}

export async function RunList({ searchParams }: RunListProps) {
    const params = await searchParams
    const runs = await getPredictionRuns(params.benchmark, params.model)

    if (runs.length === 0) {
        return (
            <div className="text-muted-foreground py-12 text-center">
                <p>No prediction runs found.</p>
                <p className="mt-2 text-sm">Load prediction data using the data loading scripts.</p>
            </div>
        )
    }

    // Group runs by benchmark
    const runsByBenchmark = runs.reduce(
        (acc, run) => {
            const benchmarkName = run.benchmarkSet.name
            if (!acc[benchmarkName]) {
                acc[benchmarkName] = []
            }
            acc[benchmarkName].push(run)
            return acc
        },
        {} as Record<string, typeof runs>
    )

    return (
        <div className="space-y-8">
            {Object.entries(runsByBenchmark).map(([benchmarkName, benchmarkRuns]) => (
                <div key={benchmarkName} className="space-y-3">
                    <h2 className="text-xl font-semibold">{benchmarkName}</h2>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Model</TableHead>
                                <TableHead className="text-right">Routes</TableHead>
                                <TableHead className="text-right">Duration</TableHead>
                                <TableHead className="text-right">Cost</TableHead>
                                <TableHead className="text-right">Executed</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {benchmarkRuns.map((run) => (
                                <TableRow key={run.id} className="group hover:bg-muted/50 relative transition-colors">
                                    <TableCell className="font-semibold">
                                        <Link
                                            href={`/runs/${run.id}`}
                                            className="focus:ring-primary rounded-sm outline-none after:absolute after:inset-0 focus:ring-2"
                                            prefetch={true}
                                        >
                                            {run.modelInstance.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant="secondary">{run.totalRoutes.toLocaleString()}</Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-right">
                                        {run.totalWallTime ? `${(run.totalWallTime / 60).toFixed(1)} min` : '—'}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-right">
                                        {run.totalCost ? `$${run.totalCost.toFixed(2)}` : '—'}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-right">
                                        {formatDistanceToNow(new Date(run.executedAt), {
                                            addSuffix: true,
                                        })}
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
