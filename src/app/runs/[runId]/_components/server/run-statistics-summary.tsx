import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

import { getRunStatistics } from '@/lib/services/prediction.service'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type RunStatisticsSummaryProps = {
    runId: string
    searchParams: Promise<{ stock?: string }>
}

export async function RunStatisticsSummary({ runId, searchParams }: RunStatisticsSummaryProps) {
    const params = await searchParams
    const stockId = params.stock

    if (!stockId || stockId === 'all') {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Select a stock to view statistics for this run.</AlertDescription>
            </Alert>
        )
    }

    const statistics = await getRunStatistics(runId, stockId)

    if (!statistics) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    No statistics available for this stock. Run the scoring pipeline to generate metrics.
                </AlertDescription>
            </Alert>
        )
    }

    // Get overall metrics
    const parsedStats = statistics.statistics
    if (!parsedStats) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Could not parse statistics data for this run.</AlertDescription>
            </Alert>
        )
    }

    const solvability = parsedStats.solvability.overall
    const hasTopK = parsedStats.topKAccuracy && Object.keys(parsedStats.topKAccuracy).length > 0

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Solvability */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-muted-foreground text-sm font-medium">Solvability</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{(solvability.value * 100).toFixed(1)}%</div>
                        <p className="text-muted-foreground text-xs">
                            ±{((solvability.ciUpper - solvability.ciLower) * 50).toFixed(1)}%
                        </p>
                        {solvability.reliability.code !== 'OK' && (
                            <Badge variant="outline" className="mt-2">
                                {solvability.reliability.code}
                            </Badge>
                        )}
                    </CardContent>
                </Card>

                {/* Top-1 */}
                {hasTopK && parsedStats.topKAccuracy?.['Top-1'] && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-muted-foreground text-sm font-medium">Top-1 Accuracy</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {(parsedStats.topKAccuracy['Top-1'].overall.value * 100).toFixed(1)}%
                            </div>
                            <p className="text-muted-foreground text-xs">
                                ±
                                {(
                                    (parsedStats.topKAccuracy['Top-1'].overall.ciUpper -
                                        parsedStats.topKAccuracy['Top-1'].overall.ciLower) *
                                    50
                                ).toFixed(1)}
                                %
                            </p>
                            {parsedStats.topKAccuracy['Top-1'].overall.reliability.code !== 'OK' && (
                                <Badge variant="outline" className="mt-2">
                                    {parsedStats.topKAccuracy['Top-1'].overall.reliability.code}
                                </Badge>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Top-5 */}
                {hasTopK && parsedStats.topKAccuracy?.['Top-5'] && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-muted-foreground text-sm font-medium">Top-5 Accuracy</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {(parsedStats.topKAccuracy['Top-5'].overall.value * 100).toFixed(1)}%
                            </div>
                            <p className="text-muted-foreground text-xs">
                                ±
                                {(
                                    (parsedStats.topKAccuracy['Top-5'].overall.ciUpper -
                                        parsedStats.topKAccuracy['Top-5'].overall.ciLower) *
                                    50
                                ).toFixed(1)}
                                %
                            </p>
                            {parsedStats.topKAccuracy['Top-5'].overall.reliability.code !== 'OK' && (
                                <Badge variant="outline" className="mt-2">
                                    {parsedStats.topKAccuracy['Top-5'].overall.reliability.code}
                                </Badge>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Top-10 */}
                {hasTopK && parsedStats.topKAccuracy?.['Top-10'] && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-muted-foreground text-sm font-medium">Top-10 Accuracy</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {(parsedStats.topKAccuracy['Top-10'].overall.value * 100).toFixed(1)}%
                            </div>
                            <p className="text-muted-foreground text-xs">
                                ±
                                {(
                                    (parsedStats.topKAccuracy['Top-10'].overall.ciUpper -
                                        parsedStats.topKAccuracy['Top-10'].overall.ciLower) *
                                    50
                                ).toFixed(1)}
                                %
                            </p>
                            {parsedStats.topKAccuracy['Top-10'].overall.reliability.code !== 'OK' && (
                                <Badge variant="outline" className="mt-2">
                                    {parsedStats.topKAccuracy['Top-10'].overall.reliability.code}
                                </Badge>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="text-muted-foreground text-sm">
                <Link href="#" className="hover:underline">
                    View Full Statistics →
                </Link>
            </div>
        </div>
    )
}
