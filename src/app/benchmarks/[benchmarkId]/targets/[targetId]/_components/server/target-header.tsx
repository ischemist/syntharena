import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import * as benchmarkService from '@/lib/services/benchmark.service'
import { RouteLengthBadge, RouteTypeBadge } from '@/components/route-badges'
import { SmileDrawerSvg } from '@/components/smile-drawer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface TargetHeaderProps {
    benchmarkId: string
    targetId: string
}

/**
 * Server component that fetches and displays target header information.
 * Shows the target molecule structure prominently with metadata in a 2-column layout.
 * Left column: molecule structure with smile drawer
 * Right column: target ID, badges, SMILES, and InChiKey
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

            {/* Target information card with 2-column layout */}
            <Card variant="bordered">
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {/* Left column: Molecule structure */}
                        <div className="flex items-center justify-center">
                            <SmileDrawerSvg smilesStr={target.molecule.smiles} width={200} height={200} />
                        </div>

                        {/* Right column: Target info */}
                        <div className="space-y-4">
                            {/* Target ID */}
                            <div>
                                <h1 className="truncate font-mono text-lg font-medium">{target.targetId}</h1>
                            </div>

                            {/* Badges */}
                            <div className="flex flex-wrap items-center gap-2">
                                {target.routeLength !== null && (
                                    <RouteLengthBadge length={target.routeLength} variant="ghost" />
                                )}
                                {target.isConvergent !== null && (
                                    <RouteTypeBadge isConvergent={target.isConvergent} variant="ghost" />
                                )}
                                {target.hasGroundTruth && <Badge variant="secondary">Has Ground Truth</Badge>}
                            </div>

                            {/* SMILES */}
                            <div>
                                <p className="text-muted-foreground mb-1 text-xs font-semibold">SMILES</p>
                                <p className="font-mono text-xs break-all">{target.molecule.smiles}</p>
                            </div>

                            {/* InChiKey */}
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
