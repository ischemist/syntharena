import * as algorithmView from '@/lib/services/view/algorithm.view'

import { AlgorithmDetailHeader } from './algorithm-detail-header'
import { ModelInstanceTable } from './model-instance-table'

interface AlgorithmDetailContentProps {
    slug: string
}

/**
 * Async server component that fetches and renders the full algorithm detail page.
 * Combines header and model instance table in a single data fetch.
 */
export async function AlgorithmDetailContent({ slug }: AlgorithmDetailContentProps) {
    const { algorithm, instances } = await algorithmView.getAlgorithmDetailPageData(slug)

    return (
        <div className="flex flex-col gap-8">
            <AlgorithmDetailHeader algorithm={algorithm} />
            <ModelInstanceTable instances={instances} />
        </div>
    )
}
