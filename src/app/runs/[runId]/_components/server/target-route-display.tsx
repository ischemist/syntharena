import { AlertCircle } from 'lucide-react'

import type { RouteNodeWithDetails } from '@/types'
import { getTargetPredictions } from '@/lib/services/prediction.service'
import { checkMoleculesInStockByInchiKey } from '@/lib/services/stock.service'
import { SmileDrawerSvg } from '@/components/smile-drawer'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { PredictionNavigator } from '../client/prediction-navigator'
import { RouteDisplayCard } from '../client/route-display-card'

/**
 * Recursively collects all InChiKeys from a route tree.
 */
function collectInchiKeysFromRouteNode(node: RouteNodeWithDetails, set: Set<string>): void {
    set.add(node.molecule.inchikey)
    if (node.children) {
        node.children.forEach((child) => collectInchiKeysFromRouteNode(child, set))
    }
}

type TargetRouteDisplayProps = {
    runId: string
    targetId: string
    rank: number
    stockId?: string
}

export async function TargetRouteDisplay({ runId, targetId, rank, stockId }: TargetRouteDisplayProps) {
    // Fetch target predictions
    const targetDetail = await getTargetPredictions(targetId, runId, stockId)

    if (!targetDetail) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Target not found.</AlertDescription>
            </Alert>
        )
    }

    // Render target card regardless of whether routes exist
    const hasRoutes = targetDetail.routes.length > 0

    // Get stock items if stockId provided (for route visualization)
    let inStockInchiKeys = new Set<string>()
    let stockName: string | undefined

    if (hasRoutes && stockId && stockId !== 'all') {
        try {
            // Validate rank first to get the route
            const requestedRank = Math.max(1, Math.min(rank, targetDetail.routes.length))
            const routeDetail = targetDetail.routes.find((r) => r.route.rank === requestedRank)

            if (routeDetail) {
                // Collect all InChiKeys from the route tree
                const allInchiKeys = new Set<string>()
                collectInchiKeysFromRouteNode(routeDetail.routeNode, allInchiKeys)

                // Check which molecules from the route are in stock
                inStockInchiKeys = await checkMoleculesInStockByInchiKey(Array.from(allInchiKeys), stockId)

                // Get stock name from solvability data
                const solvabilityForStock = routeDetail.solvability.find((s) => s.stockId === stockId)
                stockName = solvabilityForStock?.stockName
            }
        } catch (error) {
            console.error('Failed to check stock availability:', error)
        }
    }

    return (
        <div className="space-y-4">
            {/* Target metadata card */}
            <Card>
                <CardHeader>
                    <CardTitle className="font-mono">{targetDetail.targetId}</CardTitle>
                    <CardDescription>
                        {targetDetail.routeLength && `Route length: ${targetDetail.routeLength} • `}
                        {targetDetail.isConvergent !== null
                            ? targetDetail.isConvergent
                                ? 'Convergent'
                                : 'Linear'
                            : 'Unknown structure'}
                        {targetDetail.hasGroundTruth && ' • Has ground truth'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Target molecule */}
                    <div>
                        <p className="text-muted-foreground mb-2 text-sm font-medium">Target Molecule</p>
                        <div className="flex items-center gap-4">
                            <SmileDrawerSvg smilesStr={targetDetail.molecule.smiles} width={200} height={200} />
                            <div className="min-w-0 flex-1">
                                <p className="text-muted-foreground font-mono text-xs break-all">
                                    {targetDetail.molecule.smiles}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Ground truth info */}
                    {targetDetail.groundTruthRank && (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                Ground truth match found at rank {targetDetail.groundTruthRank}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* No predictions warning */}
                    {!hasRoutes && (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                No predictions found for this target. The model did not generate any routes.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Only show navigator and route if we have predictions */}
            {hasRoutes && (
                <>
                    {/* Prediction navigator */}
                    <PredictionNavigator
                        currentRank={Math.max(1, Math.min(rank, targetDetail.routes.length))}
                        totalPredictions={targetDetail.routes.length}
                        targetId={targetId}
                    />

                    {/* Route visualization */}
                    {(() => {
                        const requestedRank = Math.max(1, Math.min(rank, targetDetail.routes.length))
                        const routeDetail = targetDetail.routes.find((r) => r.route.rank === requestedRank)

                        if (!routeDetail) {
                            return (
                                <Alert>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>Prediction rank {requestedRank} not found.</AlertDescription>
                                </Alert>
                            )
                        }

                        // Get solvability status for the selected stock
                        const solvability = stockId
                            ? routeDetail.solvability.find((s) => s.stockId === stockId)
                            : undefined

                        return (
                            <RouteDisplayCard
                                route={routeDetail.route}
                                routeNode={routeDetail.routeNode}
                                isSolvable={solvability?.isSolvable}
                                isGtMatch={solvability?.isGtMatch}
                                inStockInchiKeys={inStockInchiKeys}
                                stockName={stockName}
                            />
                        )
                    })()}
                </>
            )}
        </div>
    )
}
