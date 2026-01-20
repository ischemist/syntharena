import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

import type { PredictionRunWithStats } from '@/types'
import { SubmissionBadge } from '@/components/badges/submission'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function RunList({ runs }: { runs: PredictionRunWithStats[] }) {
    if (runs.length === 0) {
        return (
            <div className="text-muted-foreground py-12 text-center">
                <p>No prediction runs found for this series.</p>
                <p className="mt-2 text-sm">Load prediction data using the data loading scripts.</p>
            </div>
        )
    }

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
                                <TableHead className="text-right">Submission</TableHead>
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
                                            {run.modelInstance.family.name}
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
                                    <TableCell className="text-right">
                                        <SubmissionBadge
                                            submissionType={run.submissionType}
                                            isRetrained={run.isRetrained}
                                            size="sm"
                                            badgeStyle="soft"
                                        />
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
