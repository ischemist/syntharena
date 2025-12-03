'use client'

import { AlertCircle } from 'lucide-react'

import type { Molecule } from '@/types'
import { SmileDrawerSvg } from '@/components/smile-drawer'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

type TargetInfoCardProps = {
    targetId: string
    molecule: Molecule
    routeLength?: number | null
    isConvergent?: boolean | null
    hasAcceptableRoutes?: boolean
    acceptableMatchRank?: number | null
    hasNoPredictions?: boolean
}

/**
 * Target information card with 2-column layout.
 * Left: Molecule structure visualization
 * Right: Target metadata, badges, and SMILES
 */
export function TargetInfoCard({
    targetId,
    molecule,
    routeLength,
    isConvergent,
    hasAcceptableRoutes,
    acceptableMatchRank,
    hasNoPredictions,
}: TargetInfoCardProps) {
    return (
        <Card variant="bordered">
            <CardContent className="p-4">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Left column: Molecule structure */}
                    <div className="flex items-center justify-center">
                        <SmileDrawerSvg smilesStr={molecule.smiles} width={200} height={200} />
                    </div>

                    {/* Right column: Target info */}
                    <div className="space-y-4">
                        {/* Target ID */}
                        <div>
                            <h2 className="truncate font-mono text-lg font-semibold">{targetId}</h2>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-2">
                            {routeLength !== null && routeLength !== undefined && (
                                <Badge variant="secondary">{routeLength} steps</Badge>
                            )}
                            {isConvergent !== null && isConvergent !== undefined && (
                                <Badge variant="secondary">{isConvergent ? 'Convergent' : 'Linear'}</Badge>
                            )}
                            {hasAcceptableRoutes && <Badge variant="secondary">Has Acceptable Routes</Badge>}
                        </div>

                        {/* SMILES */}
                        <div>
                            <p className="text-muted-foreground mb-1 text-xs font-semibold">SMILES</p>
                            <p className="font-mono text-xs break-all">{molecule.smiles}</p>
                        </div>

                        {/* InChiKey */}
                        <div>
                            <p className="text-muted-foreground mb-1 text-xs font-semibold">InChiKey</p>
                            <p className="font-mono text-xs break-all">{molecule.inchikey}</p>
                        </div>

                        {/* Acceptable route match alert */}
                        {acceptableMatchRank && (
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Acceptable route match found at rank {acceptableMatchRank}
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* No predictions warning */}
                        {hasNoPredictions && (
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    No predictions found for this target. The model did not generate any routes.
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
