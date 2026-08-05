import { cache } from 'react'

import * as urlAliasData from '@/lib/services/data/url-alias.data'

export const resolveBenchmarkUrlKey = cache(async (key: string) => {
    return urlAliasData.findBenchmarkUrlDestination(key)
})

export const resolveBenchmarkTargetUrlKey = cache(async (benchmarkSetId: string, key: string) => {
    return urlAliasData.findBenchmarkTargetUrlDestination(benchmarkSetId, key)
})

export const resolvePredictionRunUrlKey = cache(async (key: string) => {
    return urlAliasData.findPredictionRunUrlDestination(key)
})

export function buildSearchParams(values: Record<string, string | string[] | undefined>): URLSearchParams {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(values)) {
        if (Array.isArray(value)) {
            for (const item of value) search.append(key, item)
        } else if (value !== undefined) {
            search.set(key, value)
        }
    }
    return search
}

export function withSearchParams(pathname: string, search: URLSearchParams): string {
    const query = search.toString()
    return query ? `${pathname}?${query}` : pathname
}

export async function resolveTargetComparisonRoute(
    benchmarkKey: string,
    targetKey: string,
    searchParams: Record<string, string | string[] | undefined>
) {
    const benchmark = await resolveBenchmarkUrlKey(benchmarkKey)
    if (!benchmark) return null
    const target = await resolveBenchmarkTargetUrlKey(benchmark.id, targetKey)
    if (!target) return null

    const originalSearch = buildSearchParams(searchParams)
    const canonicalSearch = buildSearchParams(searchParams)
    await Promise.all(
        (['model1', 'model2'] as const).map(async (key) => {
            const value = canonicalSearch.get(key)
            if (!value) return
            const run = await resolvePredictionRunUrlKey(value)
            if (run?.benchmarkSetId === benchmark.id) canonicalSearch.set(key, run.id)
        })
    )
    // External target IDs are benchmark-scoped but not path-safe (for example,
    // USPTO IDs contain '/'). Keep the deterministic internal ID in the URL.
    const canonicalPath = `/benchmarks/${benchmark.slug}/targets/${target.id}`
    return {
        benchmark,
        target,
        search: canonicalSearch,
        canonicalUrl: withSearchParams(canonicalPath, canonicalSearch),
        needsRedirect:
            benchmarkKey !== benchmark.slug ||
            targetKey !== target.id ||
            canonicalSearch.toString() !== originalSearch.toString(),
    }
}

export async function resolveRunRoute(runKey: string, searchParams: Record<string, string | string[] | undefined>) {
    const run = await resolvePredictionRunUrlKey(runKey)
    if (!run) return null
    const originalSearch = buildSearchParams(searchParams)
    const canonicalSearch = buildSearchParams(searchParams)
    const targetKey = canonicalSearch.get('target')
    if (targetKey) {
        const target = await resolveBenchmarkTargetUrlKey(run.benchmarkSetId, targetKey)
        if (target) canonicalSearch.set('target', target.id)
    }
    // RetroCast v0.5 selected the run's sole evaluation by stock ID. Solv-N
    // derives it from the run; `search` remains active target-search UI state.
    canonicalSearch.delete('stock')
    return {
        run,
        search: canonicalSearch,
        canonicalUrl: withSearchParams(`/runs/${run.id}`, canonicalSearch),
        needsRedirect: runKey !== run.id || canonicalSearch.toString() !== originalSearch.toString(),
    }
}
