import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function RunStatisticsSkeleton() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                    <CardHeader className="pb-2">
                        <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="mt-2 h-3 w-16" />
                    </CardContent>
                </Card>
            ))}
        </div>
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
