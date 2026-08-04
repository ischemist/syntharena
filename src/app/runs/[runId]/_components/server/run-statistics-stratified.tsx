import { AlertCircle } from 'lucide-react'

import type { RunStatistics, StratifiedMetric } from '@/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { StratifiedMetricsViewToggle } from '../client/stratified-metrics-view-toggle'

type RunStatisticsStratifiedProps = {
    dataPromise: Promise<RunStatistics | null>
    evaluationId?: string
}

export async function RunStatisticsStratified({ dataPromise, evaluationId }: RunStatisticsStratifiedProps) {
    if (!evaluationId) return null

    const statistics = await dataPromise
    if (!statistics?.statistics) return null

    const parsedStats = statistics.statistics
    const hasStratifiedData =
        (parsedStats.tier0Validity && Object.keys(parsedStats.tier0Validity.byStratum).length > 0) ||
        (parsedStats.solv0 && Object.keys(parsedStats.solv0.byStratum).length > 0) ||
        Object.values(parsedStats.topKAccuracy).some((metric) => Object.keys(metric.byStratum).length > 0)

    if (!hasStratifiedData) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>No stratified metrics available for this run.</AlertDescription>
            </Alert>
        )
    }

    const stratifiedMetrics: Array<{ name: string; stratified: StratifiedMetric }> = []
    if (parsedStats.tier0Validity)
        stratifiedMetrics.push({ name: 'Tier-0 valid', stratified: parsedStats.tier0Validity })
    if (parsedStats.solv0)
        stratifiedMetrics.push({ name: `Solv-0[${parsedStats.metricLabel}]`, stratified: parsedStats.solv0 })
    {
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
                <CardTitle>Metrics by Benchmark Stratum</CardTitle>
                <CardDescription>
                    Target-level performance using RetroCast&apos;s exact reported strata.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <StratifiedMetricsViewToggle metrics={stratifiedMetrics} />
            </CardContent>
        </Card>
    )
}
