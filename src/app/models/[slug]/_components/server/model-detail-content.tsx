import * as modelView from '@/lib/services/view/model.view'

import { BenchmarkPerformanceChart } from '../client/benchmark-performance-chart'
import { ModelDetailHeader } from './model-detail-header'
import { ModelExecutiveSummary } from './model-executive-summary'
import { PredictionRunTable } from './prediction-run-table'

interface ModelDetailContentProps {
    slug: string
}

/**
 * Async server component that fetches and renders the full model instance detail page.
 * Combines header, executive summary, performance chart, and prediction run table.
 */
export async function ModelDetailContent({ slug }: ModelDetailContentProps) {
    const { modelInstance, runs, summary } = await modelView.getModelInstanceDetailPageData(slug)

    // Prepare chart data from runs with Top-10 accuracy
    const chartData = runs
        .filter((run) => run.top10Accuracy != null)
        .map((run) => ({
            benchmarkId: run.benchmarkSetId,
            benchmarkName: run.benchmarkSet.name,
            top10Accuracy: run.top10Accuracy!,
        }))

    return (
        <div className="flex flex-col gap-8">
            <ModelDetailHeader modelInstance={modelInstance} />
            <ModelExecutiveSummary summary={summary} />

            <PredictionRunTable runs={runs} />

            {/* Top-10 Performance Chart */}
            {chartData.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Top-10 Performance Across Benchmarks</h2>
                    <BenchmarkPerformanceChart data={chartData} />
                </div>
            )}
        </div>
    )
}
