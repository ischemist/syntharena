import Link from 'next/link'
import { Info } from 'lucide-react'

import { getBenchmarkSets } from '@/lib/services/benchmark.service'
import { getStocks } from '@/lib/services/stock.service'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type LeaderboardFiltersProps = {
    selectedBenchmarkId?: string
    selectedStockId?: string
}

/**
 * Server component that displays benchmark and stock filter controls.
 * Shows active filter badges and ground truth availability notice.
 */
export async function LeaderboardFilters({ selectedBenchmarkId, selectedStockId }: LeaderboardFiltersProps) {
    const [benchmarks, stocks] = await Promise.all([getBenchmarkSets(), getStocks()])

    // Find selected benchmark to check ground truth status
    const selectedBenchmark = benchmarks.find((b) => b.id === selectedBenchmarkId)

    return (
        <Card>
            <CardHeader>
                <CardTitle>Filters</CardTitle>
                <CardDescription>Select benchmark and stock to view model comparison</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4">
                    {/* Benchmark Filter */}
                    <div className="flex flex-col gap-2">
                        <label htmlFor="benchmark-filter" className="text-sm font-medium">
                            Benchmark
                        </label>
                        <div className="flex flex-wrap gap-2">
                            <Link href="/leaderboard">
                                <Button variant={!selectedBenchmarkId ? 'default' : 'outline'} size="sm">
                                    All
                                </Button>
                            </Link>
                            {benchmarks.map((benchmark) => (
                                <Link
                                    key={benchmark.id}
                                    href={`/leaderboard?benchmark=${benchmark.id}${selectedStockId ? `&stock=${selectedStockId}` : ''}`}
                                >
                                    <Button
                                        variant={selectedBenchmarkId === benchmark.id ? 'default' : 'outline'}
                                        size="sm"
                                    >
                                        {benchmark.name}
                                    </Button>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Stock Filter */}
                    <div className="flex flex-col gap-2">
                        <label htmlFor="stock-filter" className="text-sm font-medium">
                            Stock
                        </label>
                        <div className="flex flex-wrap gap-2">
                            <Link
                                href={`/leaderboard${selectedBenchmarkId ? `?benchmark=${selectedBenchmarkId}` : ''}`}
                            >
                                <Button variant={!selectedStockId ? 'default' : 'outline'} size="sm">
                                    All
                                </Button>
                            </Link>
                            {stocks.map((stock) => (
                                <Link
                                    key={stock.id}
                                    href={`/leaderboard?${selectedBenchmarkId ? `benchmark=${selectedBenchmarkId}&` : ''}stock=${stock.id}`}
                                >
                                    <Button variant={selectedStockId === stock.id ? 'default' : 'outline'} size="sm">
                                        {stock.name}
                                    </Button>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Active Filters Display */}
                {(selectedBenchmarkId || selectedStockId) && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground text-sm">Active filters:</span>
                        {selectedBenchmark && <Badge variant="secondary">{selectedBenchmark.name}</Badge>}
                        {selectedStockId && stocks.find((s) => s.id === selectedStockId) && (
                            <Badge variant="secondary">{stocks.find((s) => s.id === selectedStockId)!.name}</Badge>
                        )}
                    </div>
                )}

                {/* Ground Truth Notice */}
                {selectedBenchmark && (
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                            {selectedBenchmark.name} benchmark <strong>does not have ground truth routes</strong>. Only
                            solvability metrics are available.
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    )
}
