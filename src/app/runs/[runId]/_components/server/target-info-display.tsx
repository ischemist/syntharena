import type { TargetInfo } from '@/lib/services/view/prediction.view'

import { TargetInfoCard } from '../client/target-info-card'

type TargetInfoDisplayProps = {
    targetInfo: TargetInfo
    hasNoPredictions: boolean
}

/**
 * Fast path: Displays target metadata.
 * This component receives fully resolved, flat data.
 */
export function TargetInfoDisplay({ targetInfo, hasNoPredictions }: TargetInfoDisplayProps) {
    return (
        <TargetInfoCard
            targetId={targetInfo.targetId}
            molecule={targetInfo.molecule}
            routeLength={targetInfo.routeLength}
            isConvergent={targetInfo.isConvergent}
            hasAcceptableRoutes={targetInfo.hasAcceptableRoutes}
            acceptableMatchRank={targetInfo.acceptableMatchRank}
            hasNoPredictions={hasNoPredictions}
        />
    )
}
