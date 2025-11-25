import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import * as benchmarkService from '@/lib/services/benchmark.service'
import { SmileDrawerSvg } from '@/components/smile-drawer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface TargetHeaderProps {
    benchmarkId: string
    targetId: string
}

/**
 * Server component that fetches and displays target header information.
 * Shows the target molecule structure prominently with metadata.
 * Handles 404 if target not found.
 */
export async function TargetHeader({ benchmarkId, targetId }: TargetHeaderProps) {
    let target
    try {
        target = await benchmarkService.getTargetById(targetId)
    } catch {
        notFound()
    }

    return (
        <div className="space-y-4">
            <Link href={`/benchmarks/${benchmarkId}`}>
                <Button variant="ghost" size="sm" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Benchmark
                </Button>
            </Link>

            {/* Compact target information card */}
            <Card>
                <CardContent className="p-4">
                    {/* Target ID and badges */}
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">{target.targetId}</h1>
                        {target.routeLength !== null && (
                            <Badge variant="secondary">Route Length: {target.routeLength}</Badge>
                        )}
                        {target.isConvergent !== null && (
                            <Badge variant={target.isConvergent ? 'default' : 'outline'}>
                                {target.isConvergent ? 'Convergent' : 'Linear'}
                            </Badge>
                        )}
                        {target.hasGroundTruth && <Badge variant="secondary">Has Ground Truth</Badge>}
                    </div>

                    {/* Compact molecule visualization with identifiers */}
                    <div className="grid gap-3 md:grid-cols-3">
                        {/* Molecule structure - smaller and left-aligned */}
                        <div className="flex items-center justify-center rounded p-2">
                            <SmileDrawerSvg smilesStr={target.molecule.smiles} width={120} height={120} />
                        </div>

                        {/* SMILES and InChiKey stacked on right */}
                        <div className="col-span-2 space-y-2">
                            <div>
                                <p className="text-muted-foreground mb-1 text-xs font-semibold">SMILES</p>
                                <p className="font-mono text-xs break-all">{target.molecule.smiles}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1 text-xs font-semibold">InChiKey</p>
                                <p className="font-mono text-xs break-all">{target.molecule.inchikey}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
