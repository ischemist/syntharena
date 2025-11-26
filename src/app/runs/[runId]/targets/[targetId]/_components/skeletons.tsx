import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function RouteListSkeleton() {
    return (
        <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-6 w-20" />
                            <div className="flex gap-2">
                                <Skeleton className="h-6 w-20" />
                                <Skeleton className="h-6 w-24" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-64" />
                        <Skeleton className="mt-2 h-4 w-full" />
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
