import { Suspense } from 'react'
import { AlertCircle } from 'lucide-react'

import * as predictionView from '@/lib/services/view/prediction.view'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { RouteDisplaySkeleton } from '../skeletons'
import { TargetInfoDisplay } from './target-info-display'
import { TargetRouteGraphDisplay } from './target-route-graph-display'

type TargetDisplaySectionProps = {
    runId: string
    targetId: string
    rank: number
    stockId?: string
    viewMode?: string
    acceptableIndex?: number
}

export async function TargetDisplaySection({
    runId,
    targetId,
    rank,
    stockId,
    viewMode,
    acceptableIndex,
}: TargetDisplaySectionProps) {
    // --- Fast path data fetching ---
    const [targetInfo, predictionSummaries] = await Promise.all([
        predictionView.getTargetInfo(targetId, runId, stockId),
        predictionView.getPredictionSummaries(targetId, runId),
    ])

    if (!targetInfo) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Target not found.</AlertDescription>
            </Alert>
        )
    }

    const hasPredictions = predictionSummaries.length > 0

    return (
        <div className="space-y-4">
            {/* Fast path: Target metadata renders instantly */}
            <TargetInfoDisplay targetInfo={targetInfo} hasNoPredictions={!hasPredictions} />

            {/* Slow path: Graph display is suspended */}
            {hasPredictions && (
                <Suspense
                    key={`${targetId}-${rank}-${viewMode}-${acceptableIndex}`} // Key ensures suspense resets on navigation
                    fallback={<RouteDisplaySkeleton />}
                >
                    <TargetRouteGraphDisplay
                        runId={runId}
                        targetId={targetId}
                        rank={rank}
                        totalPredictions={predictionSummaries.length}
                        stockId={stockId}
                        viewMode={viewMode}
                        acceptableIndex={acceptableIndex}
                    />
                </Suspense>
            )}
        </div>
    )
}
