/**
 * view model composition layer for algorithms.
 */
import type {
    Algorithm,
    AlgorithmHighlightMetric,
    AlgorithmListItem,
    ModelFamily,
    ModelInstanceListItem,
} from '@/types'
import { HIGHLIGHT_BENCHMARK_IDS, HIGHLIGHT_METRICS } from '@/lib/constants'
import { formatVersion } from '@/lib/utils'

import * as algorithmData from '../data/algorithm.data'
import * as modelFamilyData from '../data/model-family.data' // NEW
import * as modelData from '../data/model.data'
import * as statsData from '../data/stats.data'

/** prepares the DTO for the main algorithm list page. */
export async function getAlgorithmListItems(): Promise<AlgorithmListItem[]> {
    // fetch in parallel
    const [rawAlgorithms, countsMap] = await Promise.all([
        algorithmData.findAlgorithmListItems(),
        algorithmData.getAlgorithmInstanceCountsMap(),
    ])

    return rawAlgorithms.map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        description: a.description,
        instanceCount: countsMap.get(a.id) ?? 0,
    }))
}

// UPDATED DTO for the detail page
export interface AlgorithmDetailPageData {
    algorithm: Algorithm
    families: Array<ModelFamily & { instances: ModelInstanceListItem[] }>
    highlightMetrics: AlgorithmHighlightMetric[]
}

/** prepares the "mega-dto" for the algorithm detail page with the new hierarchy. */
export async function getAlgorithmDetailPageData(slug: string): Promise<AlgorithmDetailPageData> {
    const algorithm = await algorithmData.findAlgorithmBySlug(slug)

    // fetch families, all instances for those families, and metrics in parallel
    const [rawFamilies, rawMetrics] = await Promise.all([
        modelFamilyData.findModelFamiliesByAlgorithmId(algorithm.id),
        statsData.findBestMetricsForAlgorithm(algorithm.id, [...HIGHLIGHT_BENCHMARK_IDS], [...HIGHLIGHT_METRICS]),
    ])

    // now fetch all instances for all found families in one go
    const familyIds = rawFamilies.map((f) => f.id)
    const allInstancesForAlgo = familyIds.length > 0 ? await modelData.findModelInstancesByFamilyId(familyIds) : []

    // group instances by familyId for efficient mapping
    const instancesByFamilyId = new Map<string, typeof allInstancesForAlgo>()
    for (const instance of allInstancesForAlgo) {
        if (!instancesByFamilyId.has(instance.modelFamilyId)) {
            instancesByFamilyId.set(instance.modelFamilyId, [])
        }
        instancesByFamilyId.get(instance.modelFamilyId)!.push(instance)
    }

    const families = rawFamilies.map((family) => {
        const instancesForFamily = instancesByFamilyId.get(family.id) ?? []
        return {
            ...family,
            description: family.description ?? undefined,
            instances: instancesForFamily.map((i) => ({
                ...i,
                versionPrerelease: i.versionPrerelease ?? undefined,
                runCount: i._count.runs,
            })),
        }
    })

    const highlightMetrics = buildHighlightMetrics(rawMetrics)

    return { algorithm, families, highlightMetrics }
}

/**
 * groups metrics by (benchmarkId, metricName) and picks the best (highest value) for each.
 * now uses family name and instance slug/version for display
 */
function buildHighlightMetrics(rawMetrics: statsData.BestMetricPayload[]): AlgorithmHighlightMetric[] {
    const bestByKey = new Map<string, AlgorithmHighlightMetric>()

    for (const metric of rawMetrics) {
        const { statistics, metricName, value, ciLower, ciUpper } = metric
        const benchmarkId = statistics.benchmarkSetId
        const key = `${benchmarkId}:${metricName}`

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
            modelInstanceName: modelInstance.family.name,
            modelInstanceSlug: modelInstance.slug,
            version: formatVersion(modelInstance),
        })
    }

    return Array.from(bestByKey.values()).sort((a, b) => {
        const benchCmp = a.benchmarkName.localeCompare(b.benchmarkName)
        return benchCmp !== 0 ? benchCmp : a.metricName.localeCompare(b.metricName)
    })
}
