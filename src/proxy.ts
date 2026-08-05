import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import {
    buildSearchParams,
    resolveBenchmarkUrlKey,
    resolveRunRoute,
    resolveTargetComparisonRoute,
    withSearchParams,
} from '@/lib/routing/url-resolver'

function requestSearchParams(request: NextRequest): Record<string, string | string[]> {
    const values: Record<string, string | string[]> = {}
    for (const [key, value] of request.nextUrl.searchParams) {
        const current = values[key]
        if (current === undefined) values[key] = value
        else values[key] = Array.isArray(current) ? [...current, value] : [current, value]
    }
    return values
}

function permanentRedirect(request: NextRequest, destination: string) {
    return NextResponse.redirect(new URL(destination, request.url), 308)
}

export async function proxy(request: NextRequest) {
    const segments = request.nextUrl.pathname.split('/').filter(Boolean)
    const search = requestSearchParams(request)

    if (segments[0] === 'benchmarks' && segments[1]) {
        const benchmarkKey = segments[1]
        if (segments[2] === 'targets' && segments[3]) {
            const route = await resolveTargetComparisonRoute(benchmarkKey, segments[3], search)
            if (route?.needsRedirect) return permanentRedirect(request, route.canonicalUrl)
        } else {
            const benchmark = await resolveBenchmarkUrlKey(benchmarkKey)
            if (benchmark && (benchmarkKey !== benchmark.slug || segments[2] === 'targets')) {
                return permanentRedirect(
                    request,
                    withSearchParams(`/benchmarks/${benchmark.slug}`, buildSearchParams(search))
                )
            }
        }
    }

    if (segments[0] === 'runs' && segments[1]) {
        const target = request.nextUrl.searchParams.get('target')
        const isCanonicalRun = segments[1].startsWith('sa_')
        const hasCanonicalTarget = !target || target.startsWith('sa_')
        if (isCanonicalRun && hasCanonicalTarget && !request.nextUrl.searchParams.has('stock')) {
            return NextResponse.next()
        }
        const route = await resolveRunRoute(segments[1], search)
        if (route?.needsRedirect) return permanentRedirect(request, route.canonicalUrl)
    }

    if (segments[0] === 'leaderboard') {
        const benchmarkKey = request.nextUrl.searchParams.get('benchmarkId')
        if (benchmarkKey) {
            const benchmark = await resolveBenchmarkUrlKey(benchmarkKey)
            if (benchmark && benchmarkKey !== benchmark.slug) {
                const canonicalSearch = buildSearchParams(search)
                canonicalSearch.set('benchmarkId', benchmark.slug)
                return permanentRedirect(request, withSearchParams('/leaderboard', canonicalSearch))
            }
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/benchmarks/:path*', '/runs/:path*', '/leaderboard'],
}
