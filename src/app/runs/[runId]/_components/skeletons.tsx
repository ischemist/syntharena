import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function RunStatisticsSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="mt-2 h-4 w-96" />
            </CardHeader>
            <CardContent>
                <MetricsChartSkeleton />
            </CardContent>
        </Card>
    )
}

export function StratifiedStatisticsSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-64" />
                <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
            </CardHeader>
            <CardContent>
                <MetricsChartSkeleton />
            </CardContent>
        </Card>
    )
}

export function TargetGridSkeleton() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
                <Card key={i}>
                    <CardHeader>
                        <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-3 w-16" />
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

export function MetricsChartSkeleton() {
    return (
        <div className="space-y-4">
            {/* Toggle buttons */}
            <div className="flex justify-end gap-2">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-20" />
            </div>
            {/* Chart area */}
            <div className="flex h-[400px] items-center justify-center rounded-lg border">
                <Skeleton className="h-64 w-full" />
            </div>
            {/* Footer */}
            <Skeleton className="h-4 w-48" />
        </div>
    )
}
