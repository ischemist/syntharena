import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading skeleton for target detail page.
 * Shows placeholder for target molecule and route data.
 */
export function TargetDetailSkeleton() {
    return (
        <div className="space-y-6">
            {/* Back button */}
            <Skeleton className="h-9 w-40" />

            {/* Target header */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-48" /> {/* Target ID */}
                    <Skeleton className="h-6 w-20 rounded-full" /> {/* Badge */}
                </div>

                {/* Large molecule structure */}
                <Card>
                    <CardContent className="p-6">
                        <Skeleton className="h-[400px] w-full" />
                    </CardContent>
                </Card>

                {/* Route metadata */}
                <div className="flex gap-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
            </div>

            {/* Route JSON viewer */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[600px] w-full" />
                </CardContent>
            </Card>
        </div>
    )
}
