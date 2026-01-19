import Link from 'next/link'

import * as algorithmView from '@/lib/services/view/algorithm.view'

import { CopyButton } from '../client/copy-button'
import { AggregatePerformance } from './aggregate-performance'
import { AlgorithmDetailHeader, formatBibtex } from './algorithm-detail-header'
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
            <div className="space-y-8">
                <h2 className="text-xl font-semibold">Model Families</h2>
                {families.length > 0 ? (
                    families.map((family) => (
                        <div key={family.id} className="space-y-4">
                            <h3 className="text-lg font-semibold">
                                <Link href={`/model-families/${family.slug}`} className="text-primary hover:underline">
                                    {family.name}
                                </Link>
                            </h3>
                            {family.description && (
                                <p className="text-muted-foreground max-w-2xl text-sm">{family.description}</p>
                            )}
                            <ModelInstanceTable instances={family.instances} />
                        </div>
                    ))
                ) : (
                    <div className="text-muted-foreground py-8 text-center">
                        <p>no model families or versions found for this algorithm.</p>
                    </div>
                )}
            </div>

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
