import * as algorithmView from '@/lib/services/view/algorithm.view'

import { CopyButton } from '../client/copy-button'
import { AggregatePerformance } from './aggregate-performance'
import { AlgorithmDetailHeader, formatBibtex } from './algorithm-detail-header'
import { ModelInstanceTable } from './model-instance-table'

interface AlgorithmDetailContentProps {
    slug: string
}

/**
 * Async server component that fetches and renders the full algorithm detail page.
 * Combines header, aggregate performance, model instance table, and citation.
 */
export async function AlgorithmDetailContent({ slug }: AlgorithmDetailContentProps) {
    const { algorithm, instances, highlightMetrics } = await algorithmView.getAlgorithmDetailPageData(slug)

    return (
        <div className="flex flex-col gap-8">
            <AlgorithmDetailHeader algorithm={algorithm} />
            <AggregatePerformance metrics={highlightMetrics} />
            <ModelInstanceTable instances={instances} />

            {/* Citation section */}
            {algorithm.bibtex && (
                <div className="space-y-2">
                    <p className="text-muted-foreground text-sm">If you use this model in your work, cite it as</p>
                    <div className="bg-muted relative overflow-x-auto rounded-md p-4">
                        <CopyButton text={algorithm.bibtex} className="absolute top-2 right-2" />
                        <pre className="text-xs break-words whitespace-pre-wrap">
                            <code>{formatBibtex(algorithm.bibtex)}</code>
                        </pre>
                    </div>
                </div>
            )}
        </div>
    )
}
