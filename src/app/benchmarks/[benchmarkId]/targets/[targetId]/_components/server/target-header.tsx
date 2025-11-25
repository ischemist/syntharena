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

            <div className="space-y-4">
                {/* Target ID and badges */}
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight">{target.targetId}</h1>
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

                {/* Large molecule structure */}
                <Card>
                    <CardContent className="flex items-center justify-center p-8">
                        <SmileDrawerSvg smilesStr={target.molecule.smiles} width={400} height={400} />
                    </CardContent>
                </Card>

                {/* Molecule identifiers */}
                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-muted-foreground mb-2 text-xs font-semibold">SMILES</p>
                            <p className="font-mono text-sm break-all">{target.molecule.smiles}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-muted-foreground mb-2 text-xs font-semibold">InChiKey</p>
                            <p className="font-mono text-sm break-all">{target.molecule.inchikey}</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
