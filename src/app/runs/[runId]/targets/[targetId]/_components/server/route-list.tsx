import { AlertCircle, CheckCircle, XCircle } from 'lucide-react'

import { getTargetPredictions } from '@/lib/services/prediction.service'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type RouteListProps = {
    targetId: string
    runId: string
    searchParams: Promise<{ stock?: string }>
}

export async function RouteList({ targetId, runId, searchParams }: RouteListProps) {
    const params = await searchParams
    const stockId = params.stock

    const target = await getTargetPredictions(targetId, runId, stockId)

    if (!target || target.routes.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground">No routes found for this target.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            {!stockId || stockId === 'all' ? (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Select a stock to view solvability status for each route.</AlertDescription>
                </Alert>
            ) : null}

            {target.routes.map((routeDetail) => {
                const solvability = routeDetail.solvability?.find((s) => s.stockId === stockId)

                return (
                    <Card key={routeDetail.route.id}>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">Rank {routeDetail.route.rank}</CardTitle>
                                <div className="flex items-center gap-2">
                                    {solvability && (
                                        <>
                                            {solvability.isSolvable ? (
                                                <Badge variant="default" className="gap-1">
                                                    <CheckCircle className="h-3 w-3" />
                                                    Solved
                                                </Badge>
                                            ) : (
                                                <Badge variant="destructive" className="gap-1">
                                                    <XCircle className="h-3 w-3" />
                                                    Unsolved
                                                </Badge>
                                            )}
                                            {solvability.isGtMatch && (
                                                <Badge variant="secondary" className="gap-1">
                                                    ⭐ GT Match
                                                </Badge>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex items-center gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Length:</span>{' '}
                                    <span className="font-medium">{routeDetail.route.length}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Convergent:</span>{' '}
                                    <span className="font-medium">{routeDetail.route.isConvergent ? 'Yes' : 'No'}</span>
                                </div>
                            </div>
                            {routeDetail.route.contentHash && (
                                <div className="text-muted-foreground truncate font-mono text-xs">
                                    Hash: {routeDetail.route.contentHash}
                                </div>
                            )}
                            <div className="pt-2">
                                <p className="text-muted-foreground text-sm">Route visualization coming soon</p>
                            </div>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}
