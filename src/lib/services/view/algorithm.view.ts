/**
 * view model composition layer for algorithms.
 */
import type { Algorithm, AlgorithmHighlightMetric, AlgorithmListItem, ModelInstanceListItem } from '@/types'
import { HIGHLIGHT_BENCHMARK_IDS, HIGHLIGHT_METRICS } from '@/lib/constants'

import * as algorithmData from '../data/algorithm.data'
import * as modelData from '../data/model.data'
import * as statsData from '../data/stats.data'

/** prepares the DTO for the main algorithm list page. */
export async function getAlgorithmListItems(): Promise<AlgorithmListItem[]> {
    const rawAlgorithms = await algorithmData.findAlgorithmListItems()
    return rawAlgorithms.map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        description: a.description,
        instanceCount: a._count.instances,
    }))
}

export interface AlgorithmDetailPageData {
    algorithm: Algorithm
    instances: ModelInstanceListItem[]
    highlightMetrics: AlgorithmHighlightMetric[]
}

/** formats a semver version from its components. */
function formatVersion(instance: {
    versionMajor: number
    versionMinor: number
    versionPatch: number
    versionPrerelease?: string | null
}): string {
    const base = `v${instance.versionMajor}.${instance.versionMinor}.${instance.versionPatch}`
    return instance.versionPrerelease ? `${base}-${instance.versionPrerelease}` : base
}

/** prepares the "mega-dto" for the algorithm detail page. */
export async function getAlgorithmDetailPageData(slug: string): Promise<AlgorithmDetailPageData> {
    const algorithm = await algorithmData.findAlgorithmBySlug(slug)

    // fetch instances and metrics in parallel
    const [rawInstances, rawMetrics] = await Promise.all([
        modelData.findModelInstancesByAlgorithmId(algorithm.id),
        statsData.findBestMetricsForAlgorithm(algorithm.id, [...HIGHLIGHT_BENCHMARK_IDS], [...HIGHLIGHT_METRICS]),
    ])

    const instances: ModelInstanceListItem[] = rawInstances.map((i) => ({
        ...i,
        versionPrerelease: i.versionPrerelease ?? undefined,
        runCount: i._count.runs,
    }))

    // transform raw metrics into highlight DTOs, keeping only the best per (benchmark, metric)
    const highlightMetrics = buildHighlightMetrics(rawMetrics)

    return { algorithm, instances, highlightMetrics }
}

/**
 * groups metrics by (benchmarkId, metricName) and picks the best (highest value) for each.
 */
function buildHighlightMetrics(rawMetrics: statsData.BestMetricPayload[]): AlgorithmHighlightMetric[] {
    // rawMetrics is already sorted by value desc from the data layer
    const bestByKey = new Map<string, AlgorithmHighlightMetric>()

    for (const metric of rawMetrics) {
        const { statistics, metricName, value, ciLower, ciUpper } = metric
        const benchmarkId = statistics.benchmarkSetId
        const key = `${benchmarkId}:${metricName}`

        // only keep the first (highest) for each key
        if (bestByKey.has(key)) continue

        const { predictionRun } = statistics
        const { modelInstance, benchmarkSet } = predictionRun

        bestByKey.set(key, {
            benchmarkId,
            benchmarkName: benchmarkSet.name,
            metricName,
            value,
            ciLower,
            ciUpper,
            modelInstanceName: modelInstance.name,
            modelInstanceSlug: modelInstance.slug,
            version: formatVersion(modelInstance),
        })
    }

    // sort by benchmark name then metric name for consistent display
    return Array.from(bestByKey.values()).sort((a, b) => {
        const benchCmp = a.benchmarkName.localeCompare(b.benchmarkName)
        return benchCmp !== 0 ? benchCmp : a.metricName.localeCompare(b.metricName)
    })
}
