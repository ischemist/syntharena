/**
 * view model composition layer for predictions and routes.
 * rule: this file is FORBIDDEN from importing `prisma`.
 * it consumes functions from `run.data.ts` and `route.data.ts` to build
 * DTOs for the prediction-focused UI components.
 */

import type {
    PredictionRunWithStats,
    RouteNodeWithDetails,
    RouteVisualizationNode,
    TargetPredictionDetail,
} from '@/types'
import * as benchmarkData from '@/lib/services/data/benchmark.data'
import * as routeData from '@/lib/services/data/route.data'
import * as runData from '@/lib/services/data/run.data'
import { buildRouteTree } from '@/lib/tree-builder/route-tree'

/** transforms a detailed route node tree into a lightweight format for visualization. */
function toVisualizationNode(node: RouteNodeWithDetails): RouteVisualizationNode {
    return {
        smiles: node.molecule.smiles,
        inchikey: node.molecule.inchikey,
        children: node.children.length > 0 ? node.children.map(toVisualizationNode) : undefined,
    }
}

/** prepares the DTO for the main prediction run list page. */
export async function getPredictionRuns(benchmarkId?: string, modelId?: string): Promise<PredictionRunWithStats[]> {
    const runs = await runData.findPredictionRunsForList({
        ...(benchmarkId && { benchmarkSetId: benchmarkId }),
        ...(modelId && { modelInstanceId: modelId }),
    })

    return runs.map((run) => {
        const solvabilitySummary: Record<string, number> = {}
        for (const stat of run.statistics) {
            const overallMetric = stat.metrics[0]
            if (overallMetric) {
                solvabilitySummary[stat.stockId] = overallMetric.value
            }
        }

        return {
            id: run.id,
            modelInstanceId: run.modelInstanceId,
            benchmarkSetId: run.benchmarkSetId,
            modelInstance: run.modelInstance,
            benchmarkSet: run.benchmarkSet,
            totalRoutes: run.totalRoutes,
            hourlyCost: run.hourlyCost,
            totalCost: run.totalCost,
            totalWallTime: run.statistics[0]?.totalWallTime ?? null,
            avgRouteLength: run.avgRouteLength,
            solvabilitySummary,
            executedAt: run.executedAt,
        }
    })
}

/** prepares the DTO for the target detail/comparison page. this is a beast. */
export async function getTargetPredictions(
    targetId: string,
    runId: string,
    stockId?: string
): Promise<TargetPredictionDetail> {
    // parallelize data fetching from different domains
    const [targetPayload, predictionPayload] = await Promise.all([
        benchmarkData.findTargetWithDetailsById(targetId),
        routeData.findPredictionsForTarget(targetId, runId, stockId),
    ])

    const acceptableRoutesRaw = await routeData.findAcceptableRoutesForTarget(targetId)
    const acceptableRoutes = acceptableRoutesRaw.map((ar) => ({
        ...ar.route,
        id: ar.route.id,
        routeIndex: ar.routeIndex,
        // placeholder values until full route is fetched, if needed
        length: -1,
        isConvergent: false,
        signature: ar.route.signature || '',
        contentHash: ar.route.contentHash || '',
    }))

    const routesWithTrees = predictionPayload.map((pr) => {
        const routeTree = buildRouteTree(pr.route.nodes)
        const solvability = pr.solvabilityStatus.map((s) => ({
            stockId: s.stockId,
            stockName: s.stock.name,
            isSolvable: s.isSolvable,
            matchesAcceptable: s.matchesAcceptable,
            matchedAcceptableIndex: s.matchedAcceptableIndex,
        }))

        return {
            route: pr.route,
            predictionRoute: pr,
            routeNode: routeTree,
            visualizationNode: toVisualizationNode(routeTree),
            solvability,
        }
    })

    const acceptableMatchRank = routesWithTrees.find((r) => r.solvability.some((s) => s.matchesAcceptable))
        ?.predictionRoute.rank

    return {
        targetId: targetPayload.targetId,
        molecule: targetPayload.molecule,
        routeLength: targetPayload.routeLength,
        isConvergent: targetPayload.isConvergent,
        hasAcceptableRoutes: targetPayload.acceptableRoutesCount > 0,
        acceptableRoutes,
        acceptableMatchRank,
        routes: routesWithTrees,
    }
}

/** gets a specific predicted route and builds its visualization tree. */
export async function getPredictedRouteForTarget(targetId: string, runId: string, rank: number) {
    const predictionRoute = await routeData.findPredictedRouteForTarget(targetId, runId, rank)
    if (!predictionRoute || predictionRoute.route.nodes.length === 0) {
        return null
    }
    return buildRouteTree(predictionRoute.route.nodes)
}

/** DTO for prediction run summary used in model selectors. */
export interface PredictionRunSummary {
    id: string
    modelName: string
    modelVersion?: string
    algorithmName: string
    executedAt: Date
    routeCount: number
    maxRank: number
}

/** aggregates prediction routes into run summaries for a target. */
export async function getPredictionRunsForTarget(targetId: string): Promise<PredictionRunSummary[]> {
    const predictionRoutes = await routeData.findPredictionRunsForTarget(targetId)

    // aggregate by run ID
    const runMap = new Map<
        string,
        {
            run: (typeof predictionRoutes)[0]['predictionRun']
            ranks: number[]
        }
    >()

    for (const pr of predictionRoutes) {
        const existing = runMap.get(pr.predictionRun.id)
        if (existing) {
            existing.ranks.push(pr.rank)
        } else {
            runMap.set(pr.predictionRun.id, { run: pr.predictionRun, ranks: [pr.rank] })
        }
    }

    return Array.from(runMap.values()).map(({ run, ranks }) => ({
        id: run.id,
        modelName: run.modelInstance.name,
        modelVersion: run.modelInstance.version || undefined,
        algorithmName: run.modelInstance.algorithm.name,
        executedAt: run.executedAt,
        routeCount: ranks.length,
        maxRank: Math.max(...ranks),
    }))
}
