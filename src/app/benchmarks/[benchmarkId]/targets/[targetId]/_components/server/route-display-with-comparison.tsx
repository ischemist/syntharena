import type { TargetComparisonData } from '@/types'

import { ComparisonModeTabs } from '../client/comparison-mode-tabs'
import { AcceptableRouteViewer } from './acceptable-route-viewer'
import { GroundTruthComparisonView } from './ground-truth-comparison-view'
import { PredictionComparisonView } from './prediction-comparison-view'

interface RouteDisplayWithComparisonProps {
    data: TargetComparisonData
}

/**
 * [REFACTORED] main server component for route display.
 * this is now a "dumb" orchestrator that decides which specialized view to render
 * based on the `currentMode`. it no longer contains complex conditional rendering logic.
 */
export function RouteDisplayWithComparison({ data }: RouteDisplayWithComparisonProps) {
    const { currentMode, acceptableRoute } = data

    return (
        <ComparisonModeTabs currentMode={currentMode} hasAcceptableRoutes={!!acceptableRoute}>
            {{
                gtOnly: <AcceptableRouteViewer data={data} />,
                gtVsPred: <GroundTruthComparisonView data={data} />,
                predVsPred: <PredictionComparisonView data={data} />,
            }}
        </ComparisonModeTabs>
    )
}
