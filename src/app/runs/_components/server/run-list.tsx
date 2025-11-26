import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

import { getPredictionRuns } from '@/lib/services/prediction.service'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type RunListProps = {
    searchParams: Promise<{
        benchmark?: string
        model?: string
        page?: string
    }>
}

export async function RunList({ searchParams }: RunListProps) {
    const params = await searchParams
    const runs = await getPredictionRuns(params.benchmark, params.model)

    if (runs.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground">No prediction runs found.</p>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Load prediction data using the data loading scripts.
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {runs.map((run) => (
                <Link key={run.id} href={`/runs/${run.id}`}>
                    <Card className="hover:bg-muted/50 h-full transition-colors">
                        <CardHeader>
                            <CardTitle className="text-lg">{run.modelInstance.name}</CardTitle>
                            <CardDescription>{run.benchmarkSet.name}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Routes</span>
                                <Badge variant="secondary">{run.totalRoutes}</Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Executed</span>
                                <span className="text-sm">
                                    {formatDistanceToNow(new Date(run.executedAt), {
                                        addSuffix: true,
                                    })}
                                </span>
                            </div>
                            {run.totalTimeMs && (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Duration</span>
                                    <span className="text-sm">{(run.totalTimeMs / 1000 / 60).toFixed(1)} min</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </Link>
            ))}
        </div>
    )
}
