import * as modelView from '@/lib/services/view/model.view'

import { ModelDetailHeader } from './model-detail-header'
import { PredictionRunTable } from './prediction-run-table'

interface ModelDetailContentProps {
    slug: string
}

/**
 * Async server component that fetches and renders the full model instance detail page.
 * Combines header and prediction run table in a single data fetch.
 */
export async function ModelDetailContent({ slug }: ModelDetailContentProps) {
    const { modelInstance, runs } = await modelView.getModelInstanceDetailPageData(slug)

    return (
        <div className="flex flex-col gap-8">
            <ModelDetailHeader modelInstance={modelInstance} />
            <PredictionRunTable runs={runs} />
        </div>
    )
}
