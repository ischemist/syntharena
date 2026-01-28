import * as algorithmView from '@/lib/services/view/algorithm.view'
import { formatBibtex } from '@/lib/utils'
import { CopyButton } from '@/components/ui/copy-button'

import { AggregatePerformance } from './aggregate-performance'
import { AlgorithmDetailHeader } from './algorithm-detail-header'
import { ModelInstanceTable } from './model-instance-table'

interface AlgorithmDetailContentProps {
    slug: string
}

export async function AlgorithmDetailContent({ slug }: AlgorithmDetailContentProps) {
    const { algorithm, families, highlightMetrics } = await algorithmView.getAlgorithmDetailPageData(slug)

    return (
        <div className="flex flex-col gap-8">
            <AlgorithmDetailHeader algorithm={algorithm} />
            <AggregatePerformance metrics={highlightMetrics} />

            {/* new: render families in sections */}
            {families.length > 0 ? (
                <div className="space-y-6">
                    {families.map((family) => (
                        <div key={family.id} className="border-t pt-4">
                            <h3 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                                {family.name}
                            </h3>
                            {family.description && (
                                <p className="text-muted-foreground/70 mt-1 max-w-2xl text-sm">{family.description}</p>
                            )}
                            <div className="mt-3">
                                <ModelInstanceTable instances={family.instances} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-muted-foreground py-8 text-center">
                    <p>no model families or versions found for this algorithm.</p>
                </div>
            )}

            {algorithm.bibtex && (
                <div className="space-y-2">
                    <p className="text-muted-foreground text-sm">if you use this model in your work, cite it as</p>
                    <div className="bg-muted relative overflow-x-auto rounded-md p-4">
                        <CopyButton text={algorithm.bibtex} className="absolute top-2 right-2" />
                        <pre className="wrap-break-words text-xs whitespace-pre-wrap">
                            <code>{formatBibtex(algorithm.bibtex)}</code>
                        </pre>
                    </div>
                </div>
            )}
        </div>
    )
}
