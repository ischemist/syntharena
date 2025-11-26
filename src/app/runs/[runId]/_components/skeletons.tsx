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

export function TargetSearchSkeleton() {
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-10 flex-1" />
                </div>
            </CardContent>
        </Card>
    )
}

export function RouteDisplaySkeleton() {
    return (
        <div className="space-y-4">
            {/* Target metadata card */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="mt-2 h-4 w-64" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Skeleton className="mb-2 h-4 w-32" />
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-[200px] w-[200px]" />
                            <Skeleton className="h-4 flex-1" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Navigator skeleton */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between gap-4">
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-12 w-48" />
                        <Skeleton className="h-9 w-24" />
                    </div>
                </CardContent>
            </Card>

            {/* Route visualization skeleton */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <Skeleton className="h-6 w-24" />
                            <Skeleton className="mt-2 h-4 w-48" />
                        </div>
                        <Skeleton className="h-6 w-20" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-[600px] w-full rounded-md" />
                    <Skeleton className="h-16 w-full" />
                </CardContent>
            </Card>
        </div>
    )
}
