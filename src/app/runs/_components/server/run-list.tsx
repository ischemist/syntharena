import { formatDistanceToNow } from 'date-fns'

import { getPredictionRuns } from '@/lib/services/prediction.service'
import { Badge } from '@/components/ui/badge'
import { ClickableTableRow } from '@/components/ui/clickable-table-row'
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
                                <TableHead className="text-right">Executed</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {benchmarkRuns.map((run) => (
                                <ClickableTableRow key={run.id} href={`/runs/${run.id}`}>
                                    <TableCell className="font-semibold">{run.modelInstance.name}</TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant="secondary">{run.totalRoutes.toLocaleString()}</Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-right">
                                        {run.totalTimeMs ? `${(run.totalTimeMs / 1000 / 60).toFixed(1)} min` : '—'}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-right">
                                        {formatDistanceToNow(new Date(run.executedAt), {
                                            addSuffix: true,
                                        })}
                                    </TableCell>
                                </ClickableTableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ))}
        </div>
    )
}
