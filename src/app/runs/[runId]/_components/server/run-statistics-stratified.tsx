import { AlertCircle } from 'lucide-react'

import type { StratifiedMetric } from '@/types'
import { getRunStatistics } from '@/lib/services/prediction.service'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { MetricCell } from '../client/metric-cell'

type RunStatisticsStratifiedProps = {
    runId: string
    searchParams: Promise<{ stock?: string }>
}

export async function RunStatisticsStratified({ runId, searchParams }: RunStatisticsStratifiedProps) {
    const params = await searchParams
    const stockId = params.stock

    if (!stockId || stockId === 'all') {
        return null // Don't show stratified metrics without stock selection
    }

    const statistics = await getRunStatistics(runId, stockId)

    if (!statistics?.statistics) {
        return null // Don't show if no statistics available
    }

    const parsedStats = statistics.statistics

    // Get all route lengths that have data
    const lengthsWithData = new Set<number>()

    // Check solvability groups
    Object.keys(parsedStats.solvability.byGroup).forEach((key) => {
        lengthsWithData.add(parseInt(key))
    })

    // Check Top-K groups
    if (parsedStats.topKAccuracy) {
        Object.values(parsedStats.topKAccuracy).forEach((metric: StratifiedMetric) => {
            Object.keys(metric.byGroup).forEach((key) => {
                lengthsWithData.add(parseInt(key))
            })
        })
    }

    // If no stratified data, don't render
    if (lengthsWithData.size === 0) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>No stratified metrics available for this run.</AlertDescription>
            </Alert>
        )
    }

    // Sort lengths
    const sortedLengths = Array.from(lengthsWithData).sort((a, b) => a - b)

    // Collect Top-K metrics in order
    const topKMetrics: Array<{ key: string; name: string; metric: StratifiedMetric }> = []
    if (parsedStats.topKAccuracy) {
        const topKKeys = Object.keys(parsedStats.topKAccuracy).sort((a, b) => {
            const aNum = parseInt(a.replace(/^\D+/, ''))
            const bNum = parseInt(b.replace(/^\D+/, ''))
            return aNum - bNum
        })

        for (const key of topKKeys) {
            const displayName = key.startsWith('Top-') ? key : `Top-${key}`
            topKMetrics.push({
                key,
                name: displayName,
                metric: parsedStats.topKAccuracy[key],
            })
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Stratified Metrics by Route Length</CardTitle>
                <CardDescription>
                    Performance breakdown by ground truth route length. Only lengths with sufficient data (n ≥
                    threshold) are shown.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-24 text-center">Length</TableHead>
                                <TableHead className="min-w-[160px] text-center">Solvability</TableHead>
                                {topKMetrics.map(({ key, name }) => (
                                    <TableHead key={key} className="min-w-[160px] text-center">
                                        {name}
                                    </TableHead>
                                ))}
                                <TableHead className="w-20 text-center">n</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedLengths.map((length) => {
                                const solvMetric = parsedStats.solvability.byGroup[length]
                                if (!solvMetric) return null // Skip if no solvability data

                                return (
                                    <TableRow key={length}>
                                        <TableCell className="text-center font-medium">{length}</TableCell>
                                        <TableCell className="text-center">
                                            <MetricCell metric={solvMetric} showBadge />
                                        </TableCell>
                                        {topKMetrics.map(({ key, metric }) => {
                                            const topKMetric = metric.byGroup[length]
                                            if (!topKMetric) {
                                                return (
                                                    <TableCell key={key} className="text-muted-foreground text-center">
                                                        —
                                                    </TableCell>
                                                )
                                            }

                                            return (
                                                <TableCell key={key} className="text-center">
                                                    <MetricCell metric={topKMetric} showBadge />
                                                </TableCell>
                                            )
                                        })}
                                        <TableCell className="text-muted-foreground text-center">
                                            {solvMetric.nSamples}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>

                <div className="text-muted-foreground mt-4 text-sm">
                    <p>
                        Confidence intervals available on hover. Reliability indicators show LOW_N (insufficient
                        samples) or EXTREME_P (value near boundary).
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
