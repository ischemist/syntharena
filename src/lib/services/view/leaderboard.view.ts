/**
 * view model composition layer for the leaderboard.
 * this file is a pure data transformer, consuming the `stats.data` layer.
 * it follows the "unified fetch" doctrine: fetch all raw data once, then
 * transform it into all necessary DTOs in a single pass.
 */

import { Prisma } from '@prisma/client'

import type { BenchmarkListItem, LeaderboardEntry, MetricResult, StratifiedMetric } from '@/types'
import * as benchmarkData from '@/lib/services/data/benchmark.data'
import * as statsData from '@/lib/services/data/stats.data'
import {
    buildStratifiedMetric,
    displayMetricName,
    findSolv0Key,
    findTier0Key,
    metricResultFromEstimate,
    topKFromMetricKey,
} from '@/lib/retrocast-metrics'
import { formatVersion } from '@/lib/utils'

// ============================================================================
// types
// ============================================================================

/** the comprehensive DTO for the entire leaderboard page. */
export interface LeaderboardPageData {
    leaderboardEntries: LeaderboardEntry[]
    /** Key is the exact RetroCast metric label, not optional stock provenance. */
    stratifiedMetricsByLabel: Map<
        string,
        Map<
            string,
            {
                tier0Validity: StratifiedMetric
                solv0: StratifiedMetric
                topKAccuracy?: Record<string, StratifiedMetric>
            }
        >
    >
    metricLabels: Array<{ id: string; label: string; stockName?: string }>
    metadata: {
        hasAcceptableRoutes: boolean
        availableTopKMetrics: string[]
    }
    allBenchmarks: Array<{ id: string; name: string; series: BenchmarkListItem['series'] }>
    selectedBenchmark: BenchmarkListItem
    firstTargetId: string | null
}

export type RawStatsPayload = Prisma.PromiseReturnType<typeof statsData.findStatisticsForLeaderboard>

// ============================================================================
// private helpers (transformation logic)
// ============================================================================

/**
 * filters a list of raw statistics to only include the "champion instance" for each model family.
 * a champion is defined as the instance with the highest top-10 accuracy, falling back to exact-label Solv-0.
 * this is a pure function: array in, array out.
 */
export function _curateChampionStats(rawStats: RawStatsPayload): RawStatsPayload {
    const statsByFamilyAndLabel = new Map<string, RawStatsPayload>()
    for (const stat of rawStats) {
        const familyId = stat.predictionRun.modelInstance.family.id
        const groupKey = `${familyId}\u0000${stat.metricLabel}`
        if (!statsByFamilyAndLabel.has(groupKey)) {
            statsByFamilyAndLabel.set(groupKey, [])
        }
        statsByFamilyAndLabel.get(groupKey)!.push(stat)
    }

    const championStats: RawStatsPayload = []
    for (const [, familyStats] of statsByFamilyAndLabel) {
        const familyStatsWithMetrics = familyStats.map((stat) => ({
            stat,
            metricsByName: new Map(
                stat.metrics.reduce<Array<readonly [string, number]>>((pairs, metric) => {
                    if (metric.stratum === '') {
                        pairs.push([metric.metricKey, metric.value] as const)
                    }
                    return pairs
                }, [])
            ),
        }))

        // determine the best instance for this family
        const champion = familyStatsWithMetrics.reduce((best, current) => {
            const getMetric = (entry: (typeof familyStatsWithMetrics)[0], metricName: string) =>
                entry.metricsByName.get(metricName) ?? -1

            const bestTop10Key = [...best.metricsByName.keys()].find((key) => topKFromMetricKey(key) === 10)
            const currentTop10Key = [...current.metricsByName.keys()].find((key) => topKFromMetricKey(key) === 10)
            const bestTop10 = bestTop10Key ? getMetric(best, bestTop10Key) : -1
            const currentTop10 = currentTop10Key ? getMetric(current, currentTop10Key) : -1

            // if top-10 exists, it's the primary sorting key
            if (bestTop10 !== -1 || currentTop10 !== -1) {
                return currentTop10 > bestTop10 ? current : best
            }

            const bestSolv0 = getMetric(best, `solv_0[${best.stat.metricLabel}]_rate`)
            const currentSolv0 = getMetric(current, `solv_0[${current.stat.metricLabel}]_rate`)
            return currentSolv0 > bestSolv0 ? current : best
        })
        championStats.push(champion.stat)
    }
    return championStats
}

/**
 * performs the main data transformation pass, building all DTOs from the processed stats.
 * this pure function takes the definitive list of stats and returns the final data structures.
 */
export function _transformStatsToLeaderboardDTOs(
    statsToProcess: RawStatsPayload,
    hasAcceptableRoutes: boolean,
    availableTopKMetrics: string[]
) {
    const leaderboardEntries: LeaderboardEntry[] = []
    const stratifiedMetricsByLabel = new Map<
        string,
        Map<
            string,
            {
                tier0Validity: StratifiedMetric
                solv0: StratifiedMetric
                topKAccuracy?: Record<string, StratifiedMetric>
            }
        >
    >()
    const metricLabels = new Map<string, { id: string; label: string; stockName?: string }>()

    for (const stat of statsToProcess) {
        const { stock, predictionRun, metrics } = stat
        const metricsByName = new Map<string, typeof metrics>()
        const overallMetricsByName = new Map<string, (typeof metrics)[number]>()
        for (const metric of metrics) {
            const existing = metricsByName.get(metric.metricKey)
            if (existing) {
                existing.push(metric)
            } else {
                metricsByName.set(metric.metricKey, [metric])
            }
            if (metric.stratum === '') {
                overallMetricsByName.set(metric.metricKey, metric)
            }
        }
        const { modelInstance } = predictionRun
        const modelFamilyName = modelInstance.family.name
        const algorithmName = modelInstance.family.algorithm.name
        const algorithmSlug = modelInstance.family.algorithm.slug

        // -- 1. build leaderboard entry (flat list) --
        const tier0Key = findTier0Key(metrics)
        const solv0Key = findSolv0Key(metrics, stat.metricLabel)
        if (!tier0Key || !solv0Key) throw new Error(`Run evaluation ${stat.id} is missing Tier-0 or Solv-0`)
        const tier0Metric = overallMetricsByName.get(tier0Key)!
        const solv0Metric = overallMetricsByName.get(solv0Key)!
        const topKMetrics = hasAcceptableRoutes
            ? Array.from(metricsByName.entries()).flatMap(([metricName, groupedMetrics]) =>
                  topKFromMetricKey(metricName) !== null ? groupedMetrics.filter((metric) => metric.stratum === '') : []
              )
            : []

        const topKAccuracy: Record<string, MetricResult> = {}
        for (const metric of topKMetrics) {
            topKAccuracy[displayMetricName(metric.metricKey)] = metricResultFromEstimate(metric)
        }

        leaderboardEntries.push({
            runId: stat.predictionRun.id,
            evaluationId: stat.id,
            benchmarkId: stat.predictionRun.benchmarkSetId,
            hasAcceptableRoutes: predictionRun.benchmarkSet.hasAcceptableRoutes,
            algorithmName,
            algorithmSlug,
            modelFamilyName,
            modelName: modelFamilyName, // Deprecated alias for backward compat
            version: formatVersion(modelInstance),
            modelInstanceSlug: modelInstance.slug,
            benchmarkName: predictionRun.benchmarkSet.name,
            benchmarkSeries: predictionRun.benchmarkSet.series,
            stockName: stock?.name ?? stat.metricLabel,
            submissionType: predictionRun.submissionType,
            isRetrained: predictionRun.isRetrained,
            metrics: {
                tier0Validity: metricResultFromEstimate(tier0Metric),
                solv0: metricResultFromEstimate(solv0Metric),
                solv0Label: stat.metricLabel,
                ...(Object.keys(topKAccuracy).length > 0 && { topKAccuracy }),
            },
            totalWallTime: predictionRun.totalWallTime,
            totalCost: predictionRun.totalCost,
        })

        // -- 2. build stratified metrics (nested map) --
        if (!stratifiedMetricsByLabel.has(stat.metricLabel)) {
            stratifiedMetricsByLabel.set(stat.metricLabel, new Map())
        }
        const modelMap = stratifiedMetricsByLabel.get(stat.metricLabel)!

        const tier0Validity = buildStratifiedMetric(tier0Key, metrics)
        const solv0 = buildStratifiedMetric(solv0Key, metrics)
        if (!tier0Validity || !solv0) continue

        let stratifiedTopK: Record<string, StratifiedMetric> | undefined
        if (hasAcceptableRoutes) {
            const acc: Record<string, StratifiedMetric> = {}
            availableTopKMetrics.forEach((name) => {
                const key = [...metricsByName.keys()].find(
                    (metricKey) => displayMetricName(metricKey) === name && topKFromMetricKey(metricKey) !== null
                )
                const metric = key ? buildStratifiedMetric(key, metrics) : null
                if (metric) acc[name] = metric
            })
            if (Object.keys(acc).length > 0) stratifiedTopK = acc
        }

        modelMap.set(modelFamilyName, {
            tier0Validity,
            solv0,
            ...(stratifiedTopK && { topKAccuracy: stratifiedTopK }),
        })

        // -- 3. collect exact Solv labels with optional stock provenance --
        if (!metricLabels.has(stat.metricLabel)) {
            metricLabels.set(stat.metricLabel, {
                id: stat.metricLabel,
                label: stat.metricLabel,
                ...(stock && { stockName: stock.name }),
            })
        }
    }

    return {
        leaderboardEntries,
        stratifiedMetricsByLabel,
        metricLabels: Array.from(metricLabels.values()),
    }
}

// ============================================================================
// public view model orchestrator
// ============================================================================

/**
 * fetches and composes all data for the leaderboard page in one go.
 * this is the single entry point for this route's data.
 */
export async function getLeaderboardPageData(
    benchmarkId?: string,
    devMode: boolean = false
): Promise<LeaderboardPageData | null> {
    // wave 1: fetch all LISTED benchmarks to determine the effective id and populate the dropdown.
    const allBenchmarksRaw = await benchmarkData.findBenchmarkListItems()
    if (allBenchmarksRaw.length === 0) return null

    const allBenchmarks = allBenchmarksRaw.map((b) => ({ id: b.id, name: b.name, series: b.series }))

    const effectiveBenchmarkId =
        benchmarkId && allBenchmarks.some((b) => b.id === benchmarkId) ? benchmarkId : allBenchmarks[0].id

    // wave 2: fetch all data for the effective benchmark in parallel.
    const [rawStats, selectedBenchmarkRaw, firstTargetId] = await Promise.all([
        statsData.findStatisticsForLeaderboard({
            predictionRun: { benchmarkSetId: effectiveBenchmarkId },
        }),
        benchmarkData.findBenchmarkListItemById(effectiveBenchmarkId),
        benchmarkData.findFirstTargetId(effectiveBenchmarkId),
    ])

    // transform selected benchmark data into DTO
    const selectedBenchmark: BenchmarkListItem = {
        id: selectedBenchmarkRaw.id,
        name: selectedBenchmarkRaw.name,
        description: selectedBenchmarkRaw.description || undefined,
        stockId: selectedBenchmarkRaw.stockId,
        stock: selectedBenchmarkRaw.stock,
        hasAcceptableRoutes: selectedBenchmarkRaw.hasAcceptableRoutes,
        createdAt: selectedBenchmarkRaw.createdAt,
        targetCount: selectedBenchmarkRaw._count.targets,
        series: selectedBenchmarkRaw.series,
    }

    if (rawStats.length === 0) {
        return {
            leaderboardEntries: [],
            stratifiedMetricsByLabel: new Map(),
            metricLabels: [],
            metadata: {
                hasAcceptableRoutes: selectedBenchmark.hasAcceptableRoutes,
                availableTopKMetrics: [],
            },
            allBenchmarks,
            selectedBenchmark,
            firstTargetId,
        }
    }

    // determine available top-k metrics from the full, unfiltered dataset
    const topKMetricNames = new Set<string>()
    if (selectedBenchmark.hasAcceptableRoutes) {
        rawStats.forEach((stat) => {
            stat.metrics.forEach((metric) => {
                if (metric.stratum === '' && topKFromMetricKey(metric.metricKey) !== null) {
                    topKMetricNames.add(displayMetricName(metric.metricKey))
                }
            })
        })
    }
    const sortedTopKNames = Array.from(topKMetricNames).sort((a, b) => {
        const aNum = parseInt(a.replace(/^\D+/, ''))
        const bNum = parseInt(b.replace(/^\D+/, ''))
        return aNum - bNum
    })

    // step 1: curate the stats if necessary
    const statsToProcess = devMode ? rawStats : _curateChampionStats(rawStats)

    // step 2: transform the processed stats into final DTOs
    const { leaderboardEntries, stratifiedMetricsByLabel, metricLabels } = _transformStatsToLeaderboardDTOs(
        statsToProcess,
        selectedBenchmark.hasAcceptableRoutes,
        sortedTopKNames
    )

    // step 3: assemble final page-level DTO
    return {
        leaderboardEntries,
        stratifiedMetricsByLabel,
        metricLabels,
        metadata: {
            hasAcceptableRoutes: selectedBenchmark.hasAcceptableRoutes,
            availableTopKMetrics: sortedTopKNames,
        },
        allBenchmarks,
        selectedBenchmark,
        firstTargetId,
    }
}
