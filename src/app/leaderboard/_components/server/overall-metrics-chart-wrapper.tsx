import { AlertCircle } from 'lucide-react'

import { getLeaderboard } from '@/lib/services/leaderboard.service'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { OverallMetricsChart } from '../client/overall-metrics-chart'

type OverallMetricsChartWrapperProps = {
    benchmarkId?: string
    stockId?: string
}

/**
 * Server component wrapper that fetches data and passes it to the chart client component.
 */
export async function OverallMetricsChartWrapper({ benchmarkId, stockId }: OverallMetricsChartWrapperProps) {
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

    return (
        <Card>
            <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Visual comparison of model solvability across benchmarks</CardDescription>
            </CardHeader>
            <CardContent>
                <OverallMetricsChart entries={entries} />
            </CardContent>
        </Card>
    )
}
