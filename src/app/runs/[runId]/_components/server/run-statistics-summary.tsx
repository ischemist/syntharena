import { AlertCircle } from 'lucide-react'

import type { MetricResult } from '@/types'
import { getRunStatistics } from '@/lib/services/prediction.service'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { MetricCell } from '../client/metric-cell'

type RunStatisticsSummaryProps = {
    runId: string
    searchParams: Promise<{ stock?: string }>
}

export async function RunStatisticsSummary({ runId, searchParams }: RunStatisticsSummaryProps) {
    const params = await searchParams
    const stockId = params.stock

    if (!stockId || stockId === 'all') {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Select a stock to view statistics for this run.</AlertDescription>
            </Alert>
        )
    }

    const statistics = await getRunStatistics(runId, stockId)

    if (!statistics) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    No statistics available for this stock. Run the scoring pipeline to generate metrics.
                </AlertDescription>
            </Alert>
        )
    }

    // Get overall metrics
    const parsedStats = statistics.statistics
    if (!parsedStats) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Could not parse statistics data for this run.</AlertDescription>
            </Alert>
        )
    }

    const solvability = parsedStats.solvability.overall
    const hasTopK = parsedStats.topKAccuracy && Object.keys(parsedStats.topKAccuracy).length > 0

    // Build metrics table data
    const metricsRows: Array<{
        name: string
        metric: MetricResult
    }> = [{ name: 'Solvability', metric: solvability }]

    if (hasTopK && parsedStats.topKAccuracy) {
        // Add Top-K metrics in order
        const topKKeys = Object.keys(parsedStats.topKAccuracy).sort((a, b) => {
            const aNum = parseInt(a.replace(/^\D+/, ''))
            const bNum = parseInt(b.replace(/^\D+/, ''))
            return aNum - bNum
        })

        for (const key of topKKeys) {
            const displayName = key.startsWith('Top-') ? key : `Top-${key}`
            metricsRows.push({
                name: displayName,
                metric: parsedStats.topKAccuracy[key].overall,
            })
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Overall Metrics</CardTitle>
                <CardDescription>
                    Performance metrics across all targets in the benchmark. Hover over values to see 95% confidence
                    intervals.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Metric</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead className="text-right">n</TableHead>
                            <TableHead className="text-right">Reliability</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {metricsRows.map((row) => (
                            <TableRow key={row.name}>
                                <TableCell className="font-medium">{row.name}</TableCell>
                                <TableCell>
                                    <MetricCell metric={row.metric} />
                                </TableCell>
                                <TableCell className="text-muted-foreground text-right">
                                    {row.metric.nSamples}
                                </TableCell>
                                <TableCell className="text-right">
                                    {row.metric.reliability.code !== 'OK' ? (
                                        <Badge variant="outline" title={row.metric.reliability.message}>
                                            {row.metric.reliability.code}
                                        </Badge>
                                    ) : (
                                        <span className="text-muted-foreground text-sm">OK</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
