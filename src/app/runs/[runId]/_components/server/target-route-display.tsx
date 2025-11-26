import { AlertCircle } from 'lucide-react'

import { getTargetPredictions } from '@/lib/services/prediction.service'
import { searchStockMolecules } from '@/lib/services/stock.service'
import { SmileDrawerSvg } from '@/components/smile-drawer'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { PredictionNavigator } from '../client/prediction-navigator'
import { RouteDisplayCard } from './route-display-card'

type TargetRouteDisplayProps = {
    runId: string
    targetId: string
    rank: number
    stockId?: string
}

export async function TargetRouteDisplay({ runId, targetId, rank, stockId }: TargetRouteDisplayProps) {
    // Fetch target predictions
    const targetDetail = await getTargetPredictions(targetId, runId, stockId)

    if (!targetDetail || targetDetail.routes.length === 0) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>No predictions found for this target.</AlertDescription>
            </Alert>
        )
    }

    // Validate rank
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

    // Get stock items if stockId provided
    let inStockSmiles = new Set<string>()
    let stockName: string | undefined

    if (stockId && stockId !== 'all') {
        try {
            const stockMoleculesResult = await searchStockMolecules('', stockId, 10000)
            inStockSmiles = new Set(stockMoleculesResult.molecules.map((mol) => mol.smiles))

            // Get stock name from solvability data
            const solvabilityForStock = routeDetail.solvability.find((s) => s.stockId === stockId)
            stockName = solvabilityForStock?.stockName
        } catch (error) {
            console.error('Failed to fetch stock items:', error)
        }
    }

    // Get solvability status for the selected stock
    const solvability = stockId ? routeDetail.solvability.find((s) => s.stockId === stockId) : undefined

    return (
        <div className="space-y-4">
            {/* Target metadata card */}
            <Card>
                <CardHeader>
                    <CardTitle className="font-mono">{targetDetail.targetId}</CardTitle>
                    <CardDescription>
                        {targetDetail.routeLength && `Route length: ${targetDetail.routeLength} • `}
                        {targetDetail.isConvergent ? 'Convergent' : 'Linear'}
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
                </CardContent>
            </Card>

            {/* Prediction navigator */}
            <PredictionNavigator
                currentRank={requestedRank}
                totalPredictions={targetDetail.routes.length}
                targetId={targetId}
            />

            {/* Route visualization */}
            <RouteDisplayCard
                route={routeDetail.route}
                routeNode={routeDetail.routeNode}
                isSolvable={solvability?.isSolvable}
                isGtMatch={solvability?.isGtMatch}
                inStockSmiles={inStockSmiles}
                stockName={stockName}
            />
        </div>
    )
}
