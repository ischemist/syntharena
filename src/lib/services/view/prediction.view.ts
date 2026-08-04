/**
 * view model composition layer for predictions and routes.
 * rule: this file is FORBIDDEN from importing `prisma`.
 * it consumes functions from `run.data.ts` and `route.data.ts` to build
 * DTOs for the prediction-focused UI components.
 */

import { Prisma } from '@prisma/client'

import type {
    BenchmarkTargetWithMolecule,
    BuyableMetadata,
    PredictionRunWithStats,
    RouteLayoutMode,
    RunStatistics,
    StratifiedMetric,
    SubmissionType,
    TargetDisplayData,
    TargetInfo,
    VendorSource,
} from '@/types'

import { getAllRouteInchiKeysSet } from '@/lib/route-visualization'
import {
    buildStratifiedMetric,
    displayMetricName,
    findSolv0Key,
    findTier0Key,
    metricResultFromEstimate,
    topKFromMetricKey,
} from '@/lib/retrocast-metrics'
import * as benchmarkData from '@/lib/services/data/benchmark.data'
import * as modelFamilyData from '@/lib/services/data/model-family.data'
import * as predictionData from '@/lib/services/data/prediction.data'
import * as routeData from '@/lib/services/data/route.data'
import * as runData from '@/lib/services/data/run.data'
import * as statsData from '@/lib/services/data/stats.data'
import * as stockData from '@/lib/services/data/stock.data'
import { buildRouteTree } from '@/lib/tree-builder/route-tree'

import { toVisualizationNode } from './route.view'

// ============================================================================
// private helpers
// ============================================================================

/** a pure, testable helper for processing raw stock item data. */
function _processStockData(
    stockItems: Array<{
        ppg: number | null
        source: VendorSource | null
        leadTime: string | null
        link: string | null
        molecule: { inchikey: string }
    }>
) {
    const inStockInchiKeys = new Set<string>()
    const buyableMetadataMap = new Map<string, BuyableMetadata>()

    for (const item of stockItems) {
        inStockInchiKeys.add(item.molecule.inchikey)
        // FIX: explicitly construct the BuyableMetadata object to match the type
        buyableMetadataMap.set(item.molecule.inchikey, {
            ppg: item.ppg,
            source: item.source,
            leadTime: item.leadTime,
            link: item.link,
        })
    }

    return { inStockInchiKeys, buyableMetadataMap }
}

/** a pure, testable helper for calculating all navigation hrefs for the run target display. */
function _buildRunTargetNavigation(
    runId: string,
    params: {
        targetId: string
        rank: number
        evaluationId?: string
        acceptableIndex?: number
        layout?: string
    },
    data: {
        availableRanks: number[]
        totalAcceptableRoutes: number
    }
) {
    const buildHref = (paramToChange: string, newValue: number) => {
        const search = new URLSearchParams()
        search.set('target', params.targetId)
        search.set('rank', params.rank.toString())
        if (params.evaluationId) search.set('evaluation', params.evaluationId)
        if (params.acceptableIndex !== undefined) search.set('acceptableIndex', params.acceptableIndex.toString())
        if (params.layout) search.set('layout', params.layout)

        search.set(paramToChange, newValue.toString())
        return `/runs/${runId}?${search.toString()}`
    }

    // 1. predicted route navigation
    const currentRankIndex = data.availableRanks.indexOf(params.rank)
    let previousRankHref: string | null = null
    let nextRankHref: string | null = null
    if (currentRankIndex !== -1) {
        if (currentRankIndex > 0) {
            previousRankHref = buildHref('rank', data.availableRanks[currentRankIndex - 1])
        }
        if (currentRankIndex < data.availableRanks.length - 1) {
            nextRankHref = buildHref('rank', data.availableRanks[currentRankIndex + 1])
        }
    }

    // 2. acceptable route navigation
    const currentAcceptableIndex = params.acceptableIndex ?? 0
    const acceptableRanks = Array.from({ length: data.totalAcceptableRoutes }, (_, i) => i)
    let prevAccHref: string | null = null
    let nextAccHref: string | null = null
    if (data.totalAcceptableRoutes > 1) {
        if (currentAcceptableIndex > 0) {
            prevAccHref = buildHref('acceptableIndex', currentAcceptableIndex - 1)
        }
        if (currentAcceptableIndex < data.totalAcceptableRoutes - 1) {
            nextAccHref = buildHref('acceptableIndex', currentAcceptableIndex + 1)
        }
    }

    return {
        predictionNav: {
            currentRank: params.rank,
            availableRanks: data.availableRanks,
            previousRankHref,
            nextRankHref,
        },
        acceptableNav: {
            currentAcceptableIndex,
            availableRanks: acceptableRanks,
            previousRankHref: prevAccHref,
            nextRankHref: nextAccHref,
        },
    }
}

// ============================================================================
// public view model orchestrators
// ============================================================================

/** prepares the DTO for the main prediction run list page. */
export async function getPredictionRuns(
    benchmarkId?: string,
    modelInstanceId?: string,
    modelFamilyIds?: string[],
    submissionType?: SubmissionType,
    devMode?: boolean
): Promise<PredictionRunWithStats[]> {
    const runs = await runData.findPredictionRunsForList(
        {
            benchmarkSet: {
                isListed: true,
                ...(benchmarkId && { id: benchmarkId }),
            },
            ...(modelInstanceId && { modelInstanceId }),
            ...(modelFamilyIds &&
                modelFamilyIds.length > 0 && { modelInstance: { modelFamilyId: { in: modelFamilyIds } } }),
            ...(submissionType && { submissionType }),
        },
        devMode
    )

    return runs.map((run) => {
        const solv0Summary: NonNullable<PredictionRunWithStats['solv0Summary']> = {}
        for (const evaluation of run.evaluations) {
            const solvKey = findSolv0Key(evaluation.metrics, evaluation.metricLabel)
            const solv = solvKey
                ? evaluation.metrics.find((metric) => metric.metricKey === solvKey && metric.stratum === '')
                : undefined
            if (solv) {
                solv0Summary[evaluation.metricLabel] = {
                    label: evaluation.metricLabel,
                    metric: metricResultFromEstimate(solv),
                }
            }
        }
        const summaryMetrics = run.evaluations[0]?.metrics ?? []
        const tierKey = findTier0Key(summaryMetrics)
        const tierMetric = tierKey
            ? summaryMetrics.find((metric) => metric.metricKey === tierKey && metric.stratum === '')
            : undefined
        const top1Metric = summaryMetrics.find(
            (metric) => metric.stratum === '' && topKFromMetricKey(metric.metricKey) === 1
        )
        const top10Metric = summaryMetrics.find(
            (metric) => metric.stratum === '' && topKFromMetricKey(metric.metricKey) === 10
        )

        return {
            id: run.id,
            modelInstanceId: run.modelInstanceId,
            benchmarkSetId: run.benchmarkSetId,
            modelInstance: {
                ...run.modelInstance,
                family: {
                    ...run.modelInstance.family,
                    description: run.modelInstance.family.description ?? undefined,
                },
            },
            benchmarkSet: run.benchmarkSet,
            totalRoutes: run.totalRoutes,
            hourlyCost: run.hourlyCost,
            totalCost: run.totalCost,
            totalWallTime: run.totalWallTime,
            avgRouteLength: run.avgRouteLength,
            tier0Validity: tierMetric ? metricResultFromEstimate(tierMetric) : null,
            solv0Summary,
            top1Accuracy: top1Metric ? metricResultFromEstimate(top1Metric) : null,
            top10Accuracy: top10Metric ? metricResultFromEstimate(top10Metric) : null,
            executedAt: run.executedAt,
            submissionType: run.submissionType,
            isRetrained: run.isRetrained,
        }
    })
}

/** returns all model families that have at least one prediction run. */
export async function getModelFamiliesWithRuns() {
    return modelFamilyData.findAllModelFamiliesWithRuns()
}

/** DTO for prediction run summary used in model selectors. */
export interface PredictionRunSummary {
    id: string
    modelName: string
    modelVersion?: string
    algorithmName: string
    executedAt: Date
    routeCount: number
    availableRanks: number[]
}

/** aggregates prediction routes into run summaries for a target. */
export async function getPredictionRunsForTarget(
    targetId: string,
    devMode: boolean = false
): Promise<PredictionRunSummary[]> {
    const rawRuns = await predictionData.findPredictionRunsForTarget(targetId, devMode)

    // fetch all rank summaries in parallel
    const summaryPromises = rawRuns.map((run) => routeData.findPredictionSummaries(targetId, run.id))
    const allSummaries = await Promise.all(summaryPromises)

    return rawRuns.map((run, i) => {
        const summaries = allSummaries[i]
        const availableRanks = summaries.map((s) => s.rank)

        const { versionMajor, versionMinor, versionPatch, versionPrerelease } = run.modelInstance
        let versionString = `v${versionMajor}.${versionMinor}.${versionPatch}`
        if (versionPrerelease) versionString += `-${versionPrerelease}`

        return {
            id: run.id,
            modelName: run.modelInstance.family.name,
            modelVersion: versionString,
            algorithmName: run.modelInstance.family.algorithm.name,
            executedAt: run.executedAt,
            routeCount: run._count.predictionCandidates,
            availableRanks,
        }
    })
}

/** DTO for the run detail page breadcrumb. */
export interface RunDetailBreadcrumbData {
    modelName: string
    benchmarkId: string
    benchmarkName: string
}

/** Prepares the DTO for the run detail page breadcrumb. FAST. */
export async function getPredictionRunBreadcrumbData(runId: string): Promise<RunDetailBreadcrumbData> {
    const run = await runData.findPredictionRunBreadcrumbData(runId)
    return {
        modelName: run.modelInstance.family.name,
        benchmarkId: run.benchmarkSet.id,
        benchmarkName: run.benchmarkSet.name,
    }
}

export interface RunEvaluationListItem {
    id: string
    metricLabel: string
    stockName?: string
    stockItemCount?: number
}

/** Returns every evaluation for a run, including custom labels without stock provenance. */
export async function getEvaluationsForRun(runId: string): Promise<RunEvaluationListItem[]> {
    const evaluations = await statsData.findEvaluationsForRun(runId)
    return evaluations.map((evaluation) => ({
        id: evaluation.id,
        metricLabel: evaluation.metricLabel,
        ...(evaluation.stock && {
            stockName: evaluation.stock.name,
            stockItemCount: evaluation.stock._count.items,
        }),
    }))
}

/** returns ordered list of target IDs for a run's benchmark. */
export async function getTargetIdsByRun(
    runId: string,
    routeLength?: number,
    onlyWithPredictions?: boolean
): Promise<string[]> {
    if (onlyWithPredictions) {
        return predictionData.findTargetIdsWithPredictionsForRun(runId, routeLength)
    }
    const run = await runData.findPredictionRunDetailsById(runId)
    return benchmarkData.findTargetIdsByBenchmark(run.benchmarkSet.id, routeLength)
}

/** returns distinct route lengths available for filtering. */
export async function getAvailableRouteLengths(runId: string): Promise<number[]> {
    const run = await runData.findPredictionRunDetailsById(runId)
    if (!run.benchmarkSet.hasAcceptableRoutes) {
        return []
    }
    return benchmarkData.findAvailableRouteLengths(run.benchmarkSet.id)
}

/** Returns full statistics for one exact RetroCast evaluation identity. */
export async function getRunStatistics(runId: string, evaluationId: string): Promise<RunStatistics> {
    const evaluation = await statsData.findStatisticsForRun(runId, evaluationId)
    const tierKey = findTier0Key(evaluation.metrics)
    const solvKey = findSolv0Key(evaluation.metrics, evaluation.metricLabel)
    const topKAccuracy: Record<string, StratifiedMetric> = {}
    for (const key of new Set(evaluation.metrics.map((metric) => metric.metricKey))) {
        if (topKFromMetricKey(key) === null) continue
        const metric = buildStratifiedMetric(key, evaluation.metrics)
        if (metric) topKAccuracy[displayMetricName(key)] = metric
    }

    return {
        id: evaluation.id,
        predictionRunId: evaluation.predictionRunId,
        stockId: evaluation.stockId,
        stock: evaluation.stock
            ? {
                  id: evaluation.stock.id,
                  name: evaluation.stock.name,
                  description: evaluation.stock.description ?? undefined,
              }
            : null,
        metricLabel: evaluation.metricLabel,
        analysisJson: evaluation.analysisJson,
        statistics: {
            metricLabel: evaluation.metricLabel,
            tier0Validity: tierKey ? buildStratifiedMetric(tierKey, evaluation.metrics) : null,
            solv0: solvKey ? buildStratifiedMetric(solvKey, evaluation.metrics) : null,
            topKAccuracy,
        },
        computedAt: evaluation.createdAt,
    }
}

/**
 * searches targets within a run's benchmark by targetId or SMILES.
 */
export async function searchTargets(
    runId: string,
    query: string,
    routeLength?: number,
    onlyWithPredictions?: boolean,
    limit: number = 20
): Promise<BenchmarkTargetWithMolecule[]> {
    const where: Prisma.BenchmarkTargetWhereInput = {}
    if (query?.trim()) {
        const q = query.trim()
        where.OR = [{ targetId: { contains: q } }, { smiles: { contains: q } }]
    }
    if (routeLength !== undefined) {
        where.routeLength = routeLength
    }

    const { targets, counts } = await predictionData.findTargetsAndPredictionCountsForRun(
        runId,
        where,
        limit,
        onlyWithPredictions
    )
    const countMap = new Map(counts.map((c) => [c.targetId, c._count._all]))

    return targets.map((target) => ({
        ...target,
        hasAcceptableRoutes: false,
        acceptableRoutesCount: 0,
        routeCount: countMap.get(target.id) ?? 0,
    }))
}

/** DTO for the new run detail page title card. */
export interface RunTitleCardData {
    modelFamilyName: string
    modelFamilySlug: string
    algorithmName: string
    algorithmSlug: string
    benchmarkId: string
    benchmarkSlug: string
    benchmarkName: string
    submissionType: SubmissionType
    isRetrained?: boolean | null
    totalRoutes: number
    executedAt: Date
    totalWallTime?: number | null
    totalCost?: number | null
}

/** Prepares the DTO for the new run detail page title card. */
export async function getRunTitleCardData(runId: string): Promise<RunTitleCardData> {
    const run = await runData.findPredictionRunDetailsById(runId)
    const { modelInstance, benchmarkSet } = run
    return {
        modelFamilyName: modelInstance.family.name,
        modelFamilySlug: modelInstance.family.slug,
        algorithmName: modelInstance.family.algorithm.name,
        algorithmSlug: modelInstance.family.algorithm.slug,
        benchmarkId: benchmarkSet.id,
        benchmarkSlug: benchmarkSet.slug,
        benchmarkName: benchmarkSet.name,
        submissionType: run.submissionType,
        isRetrained: run.isRetrained,
        totalRoutes: run.totalRoutes,
        executedAt: run.executedAt,
        totalWallTime: run.totalWallTime,
        totalCost: run.totalCost,
    }
}

/** Determines the default evaluation and target for a run. */
export async function getRunDefaults(
    runId: string,
    currentEvaluationId?: string,
    currentTargetId?: string
): Promise<{ evaluationId: string | undefined; targetId: string | undefined }> {
    if (currentEvaluationId) {
        if (currentTargetId) return { evaluationId: currentEvaluationId, targetId: currentTargetId }
        const targetIds = await getTargetIdsByRun(runId)
        return { evaluationId: currentEvaluationId, targetId: targetIds[0] }
    }
    const evaluations = await getEvaluationsForRun(runId)
    if (evaluations.length === 0) return { evaluationId: undefined, targetId: undefined }
    const targetIds = await getTargetIdsByRun(runId)
    return { evaluationId: evaluations[0].id, targetId: targetIds[0] }
}

/** The "mega-dto" orchestrator for the target display section. */
export async function getTargetDisplayData(
    runId: string,
    targetId: string,
    rank: number,
    evaluationId?: string,
    acceptableIndexProp?: number,
    layout?: string
): Promise<TargetDisplayData> {
    // Wave 1
    const [targetPayload, predictionSummaries, acceptableRoutes, prediction, firstMatchRank, evaluationContext] =
        await Promise.all([
            benchmarkData.findTargetWithDetailsById(targetId),
            routeData.findPredictionSummaries(targetId, runId),
            routeData.findAcceptableRoutesForTarget(targetId),
            routeData.findSinglePredictionForTarget(targetId, runId, rank, evaluationId),
            evaluationId
                ? routeData.findFirstAcceptableMatchRank(targetId, runId, evaluationId)
                : Promise.resolve(undefined),
            evaluationId ? statsData.findEvaluationContext(runId, evaluationId) : Promise.resolve(null),
        ])

    // Process Wave 1
    const totalPredictions = predictionSummaries.length
    const hasPredictions = totalPredictions > 0
    const totalAcceptableRoutes = acceptableRoutes.length
    const currentAcceptableIndex =
        totalAcceptableRoutes > 0 ? Math.min(Math.max(0, acceptableIndexProp ?? 0), totalAcceptableRoutes - 1) : 0
    const selectedAcceptable = totalAcceptableRoutes > 0 ? acceptableRoutes[currentAcceptableIndex] : undefined
    const targetInfo: TargetInfo = {
        targetId: targetPayload.targetId,
        molecule: { ...targetPayload.molecule, smiles: targetPayload.smiles },
        routeLength: targetPayload.routeLength,
        isConvergent: targetPayload.isConvergent,
        hasAcceptableRoutes: targetPayload.acceptableRoutesCount > 0,
        acceptableMatchRank: firstMatchRank ?? undefined,
    }

    // Wave 2
    const [predictedNodes, acceptableNodes] = await Promise.all([
        prediction?.route ? routeData.findNodesForRoute(prediction.route.id) : Promise.resolve(undefined),
        selectedAcceptable ? routeData.findNodesForRoute(selectedAcceptable.route.id) : Promise.resolve(undefined),
    ])

    // Process Wave 2
    const allInchiKeys = new Set<string>()
    const predictedVizNode = predictedNodes ? toVisualizationNode(buildRouteTree(predictedNodes)) : null
    if (predictedVizNode) getAllRouteInchiKeysSet(predictedVizNode).forEach((key) => allInchiKeys.add(key))
    const acceptableVizNode = acceptableNodes ? toVisualizationNode(buildRouteTree(acceptableNodes)) : null
    if (acceptableVizNode) getAllRouteInchiKeysSet(acceptableVizNode).forEach((key) => allInchiKeys.add(key))

    // Wave 3
    let stockName: string | undefined
    let stockDataResult = {
        inStockInchiKeys: new Set<string>(),
        buyableMetadataMap: new Map<string, BuyableMetadata>(),
    }
    const stockId = evaluationContext?.stock?.id
    if (stockId) {
        const [stockItems, stockNameResult] = await Promise.all([
            allInchiKeys.size > 0
                ? stockData.findStockDataForInchiKeys(Array.from(allInchiKeys), stockId)
                : Promise.resolve([]),
            stockData.findStockNameById(stockId),
        ])
        stockName = stockNameResult?.name
        stockDataResult = _processStockData(stockItems)
    }

    // Final Assembly
    const navState = _buildRunTargetNavigation(
        runId,
        { targetId, rank, evaluationId, acceptableIndex: currentAcceptableIndex, layout },
        { availableRanks: predictionSummaries.map((s) => s.rank), totalAcceptableRoutes }
    )

    const evaluationRecord = prediction?.evaluations[0]
    const tier0Status = evaluationRecord?.tierResults.find((result) => result.tier === 0)?.status ?? null
    let currentPrediction: TargetDisplayData['currentPrediction'] = null
    if (prediction) {
        currentPrediction = {
            predictionCandidate: prediction,
            route: prediction.route ?? null,
            visualizationNode: predictedVizNode,
            evaluation: evaluationRecord
                ? {
                      metricLabel: evaluationRecord.runEvaluation.metricLabel,
                      tier0Status,
                      constraintStatus: evaluationRecord.constraintStatus,
                      matchesAcceptable: evaluationRecord.matchesAcceptable,
                  }
                : undefined,
        }
    }

    return {
        targetInfo: { ...targetInfo, hasNoPredictions: !hasPredictions },
        totalPredictions,
        currentPrediction,
        acceptableRoute: acceptableVizNode ? { visualizationNode: acceptableVizNode } : null,
        totalAcceptableRoutes,
        currentAcceptableIndex,
        stockInfo: {
            stockId,
            stockName,
            ...stockDataResult,
        },
        layout: layout as RouteLayoutMode,
        navigation: navState.predictionNav,
        acceptableRouteNav: navState.acceptableNav,
    }
}
