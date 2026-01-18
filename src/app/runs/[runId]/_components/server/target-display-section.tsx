import type { TargetDisplayData } from '@/types'

import { TargetInfoDisplay } from './target-info-display'
import { TargetRouteGraphDisplay } from './target-route-graph-display'

type TargetDisplaySectionProps = {
    data: TargetDisplayData
}

export function TargetDisplaySection({ data }: TargetDisplaySectionProps) {
    return (
        <div className="space-y-4">
            {/* Target metadata renders from the DTO */}
            <TargetInfoDisplay data={data} />

            {/* Graph display renders if predictions exist, even if current rank is not found */}
            {data.totalPredictions > 0 && <TargetRouteGraphDisplay data={data} />}
        </div>
    )
}
