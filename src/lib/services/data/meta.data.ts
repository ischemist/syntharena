/**
 * data access layer for application-wide metadata and aggregate counts.
 */
import { unstable_cache as cache } from 'next/cache'

import prisma from '@/lib/db'

const tags = ['meta']

async function _countAlgorithms() {
    return prisma.algorithm.count()
}
export const countAlgorithms = cache(_countAlgorithms, ['count-algorithms'], { tags })

async function _countModelInstances() {
    return prisma.modelInstance.count()
}
export const countModelInstances = cache(_countModelInstances, ['count-model-instances'], { tags })

async function _countPredictionRuns() {
    return prisma.predictionRun.count()
}
export const countPredictionRuns = cache(_countPredictionRuns, ['count-prediction-runs'], { tags })

async function _countRoutes() {
    return prisma.route.count()
}
export const countRoutes = cache(_countRoutes, ['count-routes'], { tags })

async function _countBenchmarks() {
    return prisma.benchmarkSet.count()
}
export const countBenchmarks = cache(_countBenchmarks, ['count-benchmarks'], { tags })

async function _getStockStats() {
    return prisma.stock.findMany({ select: { name: true, _count: { select: { items: true } } } })
}
export const getStockStats = cache(_getStockStats, ['stock-stats'], { tags: [...tags, 'stocks'] })
