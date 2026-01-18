import { AlertCircle } from 'lucide-react'

import type { TargetDisplayData } from '@/types'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { TargetInfoCard } from '../client/target-info-card'

type TargetInfoDisplayProps = {
    data: TargetDisplayData
}

/**
 * Dumb component: Displays target metadata from the pre-fetched DTO.
 */
export function TargetInfoDisplay({ data }: TargetInfoDisplayProps) {
    const { targetInfo } = data

    if (!targetInfo) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Target information not found.</AlertDescription>
            </Alert>
        )
    }

    return (
        <TargetInfoCard
            targetId={targetInfo.targetId}
            molecule={targetInfo.molecule}
            routeLength={targetInfo.routeLength}
            isConvergent={targetInfo.isConvergent}
            hasAcceptableRoutes={targetInfo.hasAcceptableRoutes}
            acceptableMatchRank={targetInfo.acceptableMatchRank}
            hasNoPredictions={targetInfo.hasNoPredictions}
        />
    )
}
