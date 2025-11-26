import { AlertCircle } from 'lucide-react'

import { getLeaderboard } from '@/lib/services/leaderboard.service'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MetricCell } from '@/app/runs/[runId]/_components/client/metric-cell'

type OverallLeaderboardTableProps = {
    benchmarkId?: string
    stockId?: string
}

/**
 * Server component that displays the main leaderboard comparison table.
 * Shows overall metrics for each model+benchmark+stock combination.
 * Dynamically shows/hides Top-K columns based on ground truth availability.
 */
export async function OverallLeaderboardTable({ benchmarkId, stockId }: OverallLeaderboardTableProps) {
    const entries = await getLeaderboard(benchmarkId, stockId)

    if (entries.length === 0) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    No leaderboard data available. Load model predictions and statistics to see comparisons.
                </AlertDescription>
            </Alert>
        )
    }

    // Determine which Top-K metrics to show (collect all unique keys)
    const topKMetricNames = new Set<string>()
    entries.forEach((entry) => {
        if (entry.metrics.topKAccuracy) {
            Object.keys(entry.metrics.topKAccuracy).forEach((k) => topKMetricNames.add(k))
        }
    })

    // Sort Top-K metric names numerically (Top-1, Top-5, Top-10, etc.)
    const sortedTopKNames = Array.from(topKMetricNames).sort((a, b) => {
        const aNum = parseInt(a.replace(/^\D+/, ''))
        const bNum = parseInt(b.replace(/^\D+/, ''))
        return aNum - bNum
    })

    const hasTopKMetrics = sortedTopKNames.length > 0

    return (
        <Card>
            <CardHeader>
                <CardTitle>Model Leaderboard</CardTitle>
                <CardDescription>
                    Performance comparison across models{!hasTopKMetrics && ' (solvability only)'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Model</TableHead>
                            <TableHead>Benchmark</TableHead>
                            <TableHead>Stock</TableHead>
                            <TableHead className="text-right">Solvability</TableHead>
                            {sortedTopKNames.map((metricName) => (
                                <TableHead key={metricName} className="text-right">
                                    {metricName}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {entries.map((entry) => {
                            const key = `${entry.modelName}-${entry.benchmarkName}-${entry.stockName}`
                            return (
                                <TableRow key={key}>
                                    <TableCell className="font-medium">{entry.modelName}</TableCell>
                                    <TableCell>{entry.benchmarkName}</TableCell>
                                    <TableCell>{entry.stockName}</TableCell>
                                    <TableCell className="text-right">
                                        <MetricCell metric={entry.metrics.solvability} showBadge />
                                    </TableCell>
                                    {sortedTopKNames.map((metricName) => {
                                        const metric = entry.metrics.topKAccuracy?.[metricName]
                                        return (
                                            <TableCell key={metricName} className="text-right">
                                                {metric ? <MetricCell metric={metric} showBadge /> : '-'}
                                            </TableCell>
                                        )
                                    })}
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>

                {!hasTopKMetrics && (
                    <p className="text-muted-foreground mt-4 text-sm">
                        * Top-K accuracy metrics are only available for benchmarks with ground truth routes
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
