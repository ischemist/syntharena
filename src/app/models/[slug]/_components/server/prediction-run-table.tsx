import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

import type { PredictionRunWithStats } from '@/types'
import { SubmissionBadge } from '@/components/badges/submission'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface PredictionRunTableProps {
    runs: PredictionRunWithStats[]
}

/**
 * Server component displaying a table of prediction runs for a model instance.
 * Shows benchmark name, routes count, duration, cost, and execution time.
 */
export function PredictionRunTable({ runs }: PredictionRunTableProps) {
    if (runs.length === 0) {
        return (
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Prediction Runs</h2>
                <div className="text-muted-foreground py-8 text-center">
                    <p>No prediction runs found for this model version.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Prediction Runs</h2>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Benchmark</TableHead>
                        <TableHead>Top-10</TableHead>
                        <TableHead className="text-right">Routes</TableHead>
                        <TableHead className="text-right">Duration</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">Executed</TableHead>
                        <TableHead className="text-right">Submission</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {runs.map((run) => (
                        <TableRow key={run.id} className="group hover:bg-muted/50 relative transition-colors">
                            <TableCell className="font-semibold">
                                <Link
                                    href={`/runs/${run.id}`}
                                    className="focus:ring-primary rounded-sm outline-none after:absolute after:inset-0 focus:ring-2"
                                    prefetch={true}
                                >
                                    {run.benchmarkSet.name}
                                </Link>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {run.benchmarkSet.hasAcceptableRoutes && run.top10Accuracy ? (
                                    <span>
                                        {(run.top10Accuracy.value * 100).toFixed(1)}%{' '}
                                        <span className="text-muted-foreground/70">
                                            [{(run.top10Accuracy.ciLower * 100).toFixed(1)},{' '}
                                            {(run.top10Accuracy.ciUpper * 100).toFixed(1)}]
                                        </span>
                                    </span>
                                ) : (
                                    '—'
                                )}
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
                                {formatDistanceToNow(new Date(run.executedAt), { addSuffix: true })}
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
    )
}
