import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/**
 * Skeleton for leaderboard card sections (bordered variant)
 */
export function LeaderboardCardSkeleton() {
    return (
        <Card variant="bordered">
            <CardHeader>
                <Skeleton className="h-7 w-48" />
                <Skeleton className="mt-2 h-4 w-64" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-64 w-full" />
            </CardContent>
        </Card>
    )
}

/**
 * Skeleton for overall leaderboard table
 */
export function LeaderboardTableSkeleton() {
    return (
        <Card variant="bordered">
            <CardHeader>
                <CardTitle>Model Leaderboard</CardTitle>
                <CardDescription>Performance comparison across models</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>
                                <Skeleton className="h-4 w-20" />
                            </TableHead>
                            <TableHead>
                                <Skeleton className="h-4 w-24" />
                            </TableHead>
                            <TableHead>
                                <Skeleton className="h-4 w-20" />
                            </TableHead>
                            <TableHead>
                                <Skeleton className="h-4 w-24" />
                            </TableHead>
                            <TableHead>
                                <Skeleton className="h-4 w-20" />
                            </TableHead>
                            <TableHead>
                                <Skeleton className="h-4 w-20" />
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell>
                                    <Skeleton className="h-4 w-32" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-4 w-28" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-4 w-24" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-8 w-20" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-8 w-20" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-8 w-20" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

/**
 * Skeleton for chart visualization
 */
export function LeaderboardChartSkeleton() {
    return (
        <Card variant="bordered">
            <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Visual comparison of model performance</CardDescription>
            </CardHeader>
            <CardContent>
                <Skeleton className="h-[400px] w-full" />
            </CardContent>
        </Card>
    )
}

/**
 * Skeleton for stratified metrics section
 */
export function StratifiedMetricsSkeleton() {
    return (
        <Card variant="bordered">
            <CardHeader>
                <CardTitle>Metrics by Route Length</CardTitle>
                <CardDescription>Performance breakdown by ground truth route length</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-64 w-full" />
            </CardContent>
        </Card>
    )
}
