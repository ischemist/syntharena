import { AlertCircle } from 'lucide-react'

import type { RunStatistics, StratifiedMetric } from '@/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { StratifiedMetricsViewToggle } from '../client/stratified-metrics-view-toggle'

type RunStatisticsStratifiedProps = {
    dataPromise: Promise<RunStatistics | null>
    stockId?: string
}

export async function RunStatisticsStratified({ dataPromise, stockId }: RunStatisticsStratifiedProps) {
    if (!stockId) return null

    const statistics = await dataPromise
    if (!statistics?.statistics) return null

    const parsedStats = statistics.statistics
    const hasStratifiedData =
        Object.keys(parsedStats.solvability.byGroup).length > 0 ||
        (parsedStats.topKAccuracy &&
            Object.values(parsedStats.topKAccuracy).some((m) => Object.keys(m.byGroup).length > 0))

    if (!hasStratifiedData) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>No stratified metrics available for this run.</AlertDescription>
            </Alert>
        )
    }

    const stratifiedMetrics: Array<{ name: string; stratified: StratifiedMetric }> = [
        { name: 'Solvability', stratified: parsedStats.solvability },
    ]
    if (parsedStats.topKAccuracy) {
        const topKKeys = Object.keys(parsedStats.topKAccuracy).sort(
            (a, b) => parseInt(a.replace(/^\D+/, '')) - parseInt(b.replace(/^\D+/, ''))
        ) // prettier-ignore
        for (const key of topKKeys) {
            stratifiedMetrics.push({
                name: key.startsWith('Top-') ? key : `Top-${key}`,
                stratified: parsedStats.topKAccuracy[key],
            })
        }
    }

    return (
        <Card variant="bordered">
            <CardHeader>
                <CardTitle>Metrics by Route Length</CardTitle>
                <CardDescription>Performance breakdown by acceptable route length.</CardDescription>
            </CardHeader>
            <CardContent>
                <StratifiedMetricsViewToggle metrics={stratifiedMetrics} />
            </CardContent>
        </Card>
    )
}
