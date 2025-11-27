import Link from 'next/link'
import { format } from 'date-fns'

import type { PredictionRunWithStats } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type RunDetailHeaderProps = {
    run: PredictionRunWithStats
}

export function RunDetailHeader({ run }: RunDetailHeaderProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-2xl">{run.modelInstance.name}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                    <div className="text-muted-foreground text-sm">Benchmark</div>
                    <Link href={`/benchmarks/${run.benchmarkSet.id}`} className="text-lg font-medium hover:underline">
                        {run.benchmarkSet.name}
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
                {run.totalTimeMs && (
                    <div>
                        <div className="text-muted-foreground text-sm">Duration</div>
                        <div className="text-lg font-medium">{(run.totalTimeMs / 1000 / 60).toFixed(1)} min</div>
                    </div>
                )}
                {run.benchmarkSet.hasGroundTruth && (
                    <div>
                        <div className="text-muted-foreground text-sm">Ground Truth</div>
                        <Badge variant="secondary" className="mt-1">
                            Available
                        </Badge>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
