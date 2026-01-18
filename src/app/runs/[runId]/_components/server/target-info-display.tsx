import type { TargetPredictionDetail } from '@/types'

import { TargetInfoCard } from '../client/target-info-card'

type TargetInfoDisplayProps = {
    targetDetail: TargetPredictionDetail
}

/**
 * Fast path: Displays target metadata.
 * This is now a "dumb" component that receives fully resolved data.
 */
export function TargetInfoDisplay({ targetDetail }: TargetInfoDisplayProps) {
    const hasRoutes = targetDetail.routes.length > 0

    return (
        <TargetInfoCard
            targetId={targetDetail.targetId}
            molecule={targetDetail.molecule}
            routeLength={targetDetail.routeLength}
            isConvergent={targetDetail.isConvergent}
            hasAcceptableRoutes={targetDetail.hasAcceptableRoutes}
            acceptableMatchRank={targetDetail.acceptableMatchRank}
            hasNoPredictions={!hasRoutes}
        />
    )
}
