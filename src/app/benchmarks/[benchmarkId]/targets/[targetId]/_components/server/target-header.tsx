import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import * as benchmarkService from '@/lib/services/benchmark.service'
import * as routeService from '@/lib/services/route.service'
import { RouteLengthBadge, RouteTypeBadge } from '@/components/route-badges'
import { SmileDrawerSvg } from '@/components/smile-drawer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'

interface TargetHeaderProps {
    benchmarkId: string
    targetId: string
}

/**
 * Server component that fetches and displays target header information.
 * Shows the target molecule structure prominently with metadata in a 2-column layout.
 * Left column: molecule structure with smile drawer
 * Right column: target ID, badges, SMILES, InChiKey, and route hashes
 * Handles 404 if target not found.
 */
export async function TargetHeader({ benchmarkId, targetId }: TargetHeaderProps) {
    let target
    try {
        target = await benchmarkService.getTargetById(targetId)
    } catch {
        notFound()
    }

    // Fetch route data if ground truth exists to get hash/signature
    let route
    if (target.groundTruthRouteId) {
        try {
            route = await routeService.getRouteById(target.groundTruthRouteId)
        } catch {
            // If route fetch fails, continue without route data
            route = null
        }
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

                            {/* Route Hashes - only show if ground truth exists and has hash data */}
                            {route && route.contentHash && (
                                <>
                                    <div>
                                        <div className="mb-1 flex items-baseline gap-1.5">
                                            <p className="text-muted-foreground text-xs font-semibold">
                                                Route Content Hash
                                            </p>
                                            <HoverCard>
                                                <HoverCardTrigger asChild>
                                                    <button className="text-muted-foreground hover:text-foreground text-xs underline decoration-dotted underline-offset-2 transition-colors">
                                                        what is this?
                                                    </button>
                                                </HoverCardTrigger>
                                                <HoverCardContent className="w-80">
                                                    <div className="space-y-2">
                                                        <h4 className="text-sm font-semibold">Content Hash</h4>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                                            A deterministic SHA-256 hash of the complete route content,
                                                            including all metadata, reaction details (mapped SMILES,
                                                            templates, reagents, solvents), rank, and provenance
                                                            information. Used to verify that two routes are semantically
                                                            identical in every detail.
                                                        </p>
                                                    </div>
                                                </HoverCardContent>
                                            </HoverCard>
                                        </div>
                                        <p className="font-mono text-xs break-all">{route.contentHash}</p>
                                    </div>
                                    {route.signature && (
                                        <div>
                                            <div className="mb-1 flex items-baseline gap-1.5">
                                                <p className="text-muted-foreground text-xs font-semibold">
                                                    Route Signature
                                                </p>
                                                <HoverCard>
                                                    <HoverCardTrigger asChild>
                                                        <button className="text-muted-foreground hover:text-foreground text-xs underline decoration-dotted underline-offset-2 transition-colors">
                                                            what is this?
                                                        </button>
                                                    </HoverCardTrigger>
                                                    <HoverCardContent className="w-80">
                                                        <div className="space-y-2">
                                                            <h4 className="text-sm font-semibold">Route Signature</h4>
                                                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                                                A canonical, order-invariant SHA-256 hash of the route
                                                                topology based only on molecular structures (InChiKeys).
                                                                Two routes with the same signature have identical
                                                                synthetic trees, regardless of metadata or reaction
                                                                details. Perfect for route deduplication and comparing
                                                                topological equivalence.
                                                            </p>
                                                        </div>
                                                    </HoverCardContent>
                                                </HoverCard>
                                            </div>
                                            <p className="font-mono text-xs break-all">{route.signature}</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
