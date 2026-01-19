import Link from 'next/link'
import { connection } from 'next/server'

import * as homeView from '@/lib/services/view/home.view'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export async function BenchmarksOverviewSection() {
    await connection()
    const benchmarks = await homeView.getBenchmarkOverview()

    // Split into two series by actual series enum value (isListed filtering handled in data layer)
    const mktBenchmarks = benchmarks.filter((b) => b.series === 'MARKET')
    const refBenchmarks = benchmarks.filter((b) => b.series === 'REFERENCE')

    return (
        <section className="py-8">
            <h2 className="mb-4 text-2xl font-semibold">Benchmark Series</h2>

            <div className="grid gap-8 md:grid-cols-2">
                <div>
                    <div className="mb-3">
                        <h3 className="text-lg font-medium">Chemist-Aligned (mkt-)</h3>
                        <p className="text-muted-foreground text-sm">
                            Practical utility assessment using commercial stocks (Buyables)
                        </p>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Benchmark</TableHead>
                                <TableHead className="text-right">Targets</TableHead>
                                <TableHead className="text-right">Runs</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mktBenchmarks.map((benchmark) => (
                                <TableRow key={benchmark.id}>
                                    <TableCell>
                                        <Link
                                            href={`/benchmarks/${benchmark.id}`}
                                            className="hover:text-foreground text-muted-foreground font-mono text-xs transition-colors"
                                        >
                                            {benchmark.name}
                                        </Link>
                                        {benchmark.description && (
                                            <div className="text-muted-foreground mt-0.5 text-xs">
                                                {benchmark.description}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                        {benchmark.targetCount}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">{benchmark.runCount}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <div>
                    <div className="mb-3">
                        <h3 className="text-lg font-medium">Developer-Aligned (ref-)</h3>
                        <p className="text-muted-foreground text-sm">
                            Fair algorithmic comparison using standardized stocks (PaRoutes)
                        </p>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Benchmark</TableHead>
                                <TableHead className="text-right">Targets</TableHead>
                                <TableHead className="text-right">Runs</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {refBenchmarks.map((benchmark) => (
                                <TableRow key={benchmark.id}>
                                    <TableCell>
                                        <Link
                                            href={`/benchmarks/${benchmark.id}`}
                                            className="hover:text-foreground text-muted-foreground font-mono text-xs transition-colors"
                                        >
                                            {benchmark.name}
                                        </Link>
                                        {benchmark.description && (
                                            <div className="text-muted-foreground mt-0.5 text-xs">
                                                {benchmark.description}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                        {benchmark.targetCount}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">{benchmark.runCount}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </section>
    )
}
