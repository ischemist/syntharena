import * as homeService from '@/lib/services/home.service'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export async function LiveStatsSection() {
    const stats = await homeService.getHomePageStats()

    return (
        <section className="py-8">
            <h2 className="mb-4 text-2xl font-semibold">Platform Statistics</h2>
            <div className="grid gap-6 md:grid-cols-2">
                <div>
                    <h3 className="mb-2 text-sm font-medium">Models & Predictions</h3>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Metric</TableHead>
                                <TableHead className="text-right">Count</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell>Algorithms</TableCell>
                                <TableCell className="text-right font-mono">{stats.totalAlgorithms}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>Model Instances</TableCell>
                                <TableCell className="text-right font-mono">{stats.totalModelInstances}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>Prediction Runs</TableCell>
                                <TableCell className="text-right font-mono">{stats.totalPredictionRuns}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>Unique Routes</TableCell>
                                <TableCell className="text-right font-mono">
                                    {stats.totalUniqueRoutes.toLocaleString()}
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>Benchmark Sets</TableCell>
                                <TableCell className="text-right font-mono">{stats.totalBenchmarks}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
                <div>
                    <h3 className="mb-2 text-sm font-medium">Stock Molecules</h3>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Stock</TableHead>
                                <TableHead className="text-right">Molecules</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.stockStats.map((stock) => (
                                <TableRow key={stock.name}>
                                    <TableCell className="font-mono text-xs">{stock.name}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        {stock.moleculeCount.toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </section>
    )
}
