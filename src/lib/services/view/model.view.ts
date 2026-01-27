/**
 * view model composition layer for model instances.
 */
import type { ModelInstance, ModelInstanceExecutiveSummary, PredictionRunWithStats } from '@/types'

import * as benchmarkData from '../data/benchmark.data'
import * as modelData from '../data/model.data'
import { getPredictionRuns } from './prediction.view'

export interface ModelInstanceDetailPageData {
    modelInstance: ModelInstance & { family: { algorithm: { name: string; slug: string } } }
    runs: PredictionRunWithStats[]
    summary: ModelInstanceExecutiveSummary
}

/**
 * Computes executive summary statistics from prediction runs.
 * Calculates averages per compound by dividing total cost/duration by number of targets.
 * Number of targets comes from the benchmark set via targetCountByBenchmark map.
 */
function computeExecutiveSummary(
    runs: PredictionRunWithStats[],
    targetCountByBenchmark: Map<string, number>
): ModelInstanceExecutiveSummary {
    if (runs.length === 0) {
        return {
            avgCostPerCompound: null,
            avgDurationPerCompound: null,
            totalRuns: 0,
            benchmarkCount: 0,
            bestTop10Accuracy: null,
        }
    }

    // Compute averages per compound
    let totalCost = 0
    let totalDuration = 0
    let totalTargets = 0
    let hasCostData = false
    let hasDurationData = false

    for (const run of runs) {
        // Get the number of targets from the benchmark set (fetched from data layer)
        const targetCount = targetCountByBenchmark.get(run.benchmarkSetId) ?? 0

        if (targetCount > 0) {
            totalTargets += targetCount

            if (run.totalCost != null) {
                totalCost += run.totalCost
                hasCostData = true
            }

            if (run.totalWallTime != null) {
                totalDuration += run.totalWallTime
                hasDurationData = true
            }
        }
    }

    // Find best Top-10 accuracy
    let bestTop10: (typeof runs)[0]['top10Accuracy'] = null
    for (const run of runs) {
        if (run.top10Accuracy) {
            if (!bestTop10 || run.top10Accuracy.value > bestTop10.value) {
                bestTop10 = run.top10Accuracy
            }
        }
    }

    // Count distinct benchmarks
    const uniqueBenchmarks = new Set(runs.map((r) => r.benchmarkSetId))

    return {
        avgCostPerCompound: hasCostData && totalTargets > 0 ? totalCost / totalTargets : null,
        avgDurationPerCompound: hasDurationData && totalTargets > 0 ? totalDuration / totalTargets : null,
        totalRuns: runs.length,
        benchmarkCount: uniqueBenchmarks.size,
        bestTop10Accuracy: bestTop10,
    }
}

/** prepares the "mega-dto" for the model instance detail page. */
export async function getModelInstanceDetailPageData(slug: string): Promise<ModelInstanceDetailPageData> {
    const modelInstance = await modelData.findModelInstanceBySlug(slug)
    const runs = await getPredictionRuns(undefined, modelInstance.id)

    // Fetch target counts for all unique benchmarks
    const uniqueBenchmarkIds = [...new Set(runs.map((r) => r.benchmarkSetId))]
    const targetCounts = await Promise.all(uniqueBenchmarkIds.map((id) => benchmarkData.findBenchmarkTargetCount(id)))
    const targetCountByBenchmark = new Map(uniqueBenchmarkIds.map((id, i) => [id, targetCounts[i]]))

    const summary = computeExecutiveSummary(runs, targetCountByBenchmark)

    return {
        // the payload from the data layer is now nested, so we just pass it through
        modelInstance: {
            ...modelInstance,
            versionPrerelease: modelInstance.versionPrerelease ?? undefined,
        },
        runs,
        summary,
    }
}
