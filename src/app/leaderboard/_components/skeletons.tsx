import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton for leaderboard card sections (bordered variant)
 */
export function LeaderboardCardSkeleton() {
    return (
        <Card variant="bordered">
            <CardHeader>
                <Skeleton className="h-7 w-48" />
                <Skeleton className="mt-2 h-4 w-64" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-64 w-full" />
            </CardContent>
        </Card>
    )
}

/**
 * Skeleton for the Pareto frontier chart.
 * Mimics the final component structure with controls and chart area.
 */
export function ParetoChartSkeleton() {
    return (
        <Card variant="bordered">
            <CardHeader>
                <CardTitle>Efficiency Frontier</CardTitle>
                <CardDescription>Visualizing the trade-off between performance and resources.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="mb-4 flex justify-end gap-4">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-8 w-48" />
                </div>
                <Skeleton className="h-[450px] w-full" />
            </CardContent>
        </Card>
    )
}
