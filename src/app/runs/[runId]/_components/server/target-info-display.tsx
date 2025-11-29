import { AlertCircle } from 'lucide-react'

import { getTargetPredictions } from '@/lib/services/prediction.service'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { TargetInfoCard } from '../client/target-info-card'

type TargetInfoDisplayProps = {
    runId: string
    targetId: string
    stockId?: string
}

/**
 * Fast path: Display target metadata without heavy route queries.
 * This component renders immediately while route graph loads separately.
 */
export async function TargetInfoDisplay({ runId, targetId, stockId }: TargetInfoDisplayProps) {
    const targetDetail = await getTargetPredictions(targetId, runId, stockId)

    if (!targetDetail) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Target not found.</AlertDescription>
            </Alert>
        )
    }

    const hasRoutes = targetDetail.routes.length > 0

    return (
        <TargetInfoCard
            targetId={targetDetail.targetId}
            molecule={targetDetail.molecule}
            routeLength={targetDetail.routeLength}
            isConvergent={targetDetail.isConvergent}
            hasGroundTruth={targetDetail.hasGroundTruth}
            groundTruthRank={targetDetail.groundTruthRank}
            hasNoPredictions={!hasRoutes}
        />
    )
}
