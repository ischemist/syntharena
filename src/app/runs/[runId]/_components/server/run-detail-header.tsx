import Link from 'next/link'
import { format } from 'date-fns'

import type { RunDetailHeaderData } from '@/lib/services/view/prediction.view'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type RunDetailHeaderProps = {
    dataPromise: Promise<RunDetailHeaderData>
}

export async function RunDetailHeader({ dataPromise }: RunDetailHeaderProps) {
    const run = await dataPromise

    return (
        <Card variant="bordered">
            <CardHeader>
                <CardTitle className="text-2xl">{run.modelName}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                    <div className="text-muted-foreground text-sm">Benchmark</div>
                    <Link href={`/benchmarks/${run.benchmarkId}`} className="text-lg font-medium hover:underline">
                        {run.benchmarkName}
                    </Link>
                </div>
                <div>
                    <div className="text-muted-foreground text-sm">Total Routes</div>
                    <div className="text-lg font-medium">{run.totalRoutes}</div>
                </div>
                <div>
                    <div className="text-muted-foreground text-sm">Executed</div>
                    <div className="text-lg font-medium">{format(new Date(run.executedAt), 'PPP')}</div>
                </div>
                {run.totalWallTime && (
                    <div>
                        <div className="text-muted-foreground text-sm">Duration</div>
                        <div className="text-lg font-medium">{(run.totalWallTime / 60).toFixed(1)} min</div>
                    </div>
                )}
                {run.totalCost && (
                    <div>
                        <div className="text-muted-foreground text-sm">Total Cost</div>
                        <div className="text-lg font-medium">${run.totalCost.toFixed(2)}</div>
                    </div>
                )}
                {run.hasAcceptableRoutes && (
                    <div>
                        <div className="text-muted-foreground text-sm">Acceptable Routes</div>
                        <Badge variant="secondary" className="mt-1">
                            Available
                        </Badge>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
