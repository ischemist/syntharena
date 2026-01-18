import { AlertCircle } from 'lucide-react'

import type { TargetPredictionDetail } from '@/types'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { TargetInfoDisplay } from './target-info-display'
import { TargetRouteGraphDisplay } from './target-route-graph-display'

type TargetDisplaySectionProps = {
    targetDetailPromise: Promise<TargetPredictionDetail | null>
    runId: string
    rank: number
    stockId?: string
    viewMode?: string
    acceptableIndex?: number
}

export async function TargetDisplaySection({
    targetDetailPromise,
    runId,
    rank,
    stockId,
    viewMode,
    acceptableIndex,
}: TargetDisplaySectionProps) {
    const targetDetail = await targetDetailPromise

    if (!targetDetail) {
        return (
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Target not found or no predictions available for this selection.</AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="space-y-4">
            {/* Fast path: Target metadata renders instantly from the resolved promise */}
            <TargetInfoDisplay targetDetail={targetDetail} />

            {/* Slow path: Graph display gets the already-resolved data and adds its own fetches */}
            <TargetRouteGraphDisplay
                targetDetail={targetDetail}
                runId={runId}
                rank={rank}
                stockId={stockId}
                viewMode={viewMode}
                acceptableIndex={acceptableIndex}
            />
        </div>
    )
}
