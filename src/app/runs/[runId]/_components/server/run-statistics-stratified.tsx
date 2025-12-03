import { AlertCircle } from 'lucide-react'

import type { StratifiedMetric } from '@/types'
import { getRunStatistics } from '@/lib/services/prediction.service'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { StratifiedMetricsViewToggle } from '../client/stratified-metrics-view-toggle'

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

    // Build stratified metrics array
    const stratifiedMetrics: Array<{
        name: string
        stratified: StratifiedMetric
    }> = [{ name: 'Solvability', stratified: parsedStats.solvability }]

    // Add Top-K metrics
    if (parsedStats.topKAccuracy) {
        const topKKeys = Object.keys(parsedStats.topKAccuracy).sort((a, b) => {
            const aNum = parseInt(a.replace(/^\D+/, ''))
            const bNum = parseInt(b.replace(/^\D+/, ''))
            return aNum - bNum
        })

        for (const key of topKKeys) {
            const displayName = key.startsWith('Top-') ? key : `Top-${key}`
            stratifiedMetrics.push({
                name: displayName,
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
