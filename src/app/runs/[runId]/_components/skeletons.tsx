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
                <div className="space-y-3">
                    {/* Table header */}
                    <div className="flex gap-4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="ml-auto h-4 w-12" />
                        <Skeleton className="h-4 w-20" />
                    </div>
                    {/* Table rows */}
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex gap-4">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="ml-auto h-4 w-12" />
                            <Skeleton className="h-4 w-20" />
                        </div>
                    ))}
                </div>
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
                <div className="space-y-3">
                    {/* Table header */}
                    <div className="flex gap-4">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="ml-auto h-4 w-12" />
                    </div>
                    {/* Table rows */}
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex gap-4">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="ml-auto h-4 w-12" />
                        </div>
                    ))}
                </div>
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
