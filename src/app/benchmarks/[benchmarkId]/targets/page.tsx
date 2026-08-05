import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'

import { buildSearchParams, resolveBenchmarkUrlKey, withSearchParams } from '@/lib/routing/url-resolver'

export const metadata: Metadata = {
    title: 'Benchmark Targets',
    description: 'Target browsing lives on the parent benchmark page; this route redirects for compatibility.',
}

interface TargetsPageProps {
    params: Promise<{ benchmarkId: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * Empty targets page that redirects to the parent benchmark page.
 * The benchmark page contains the target grid and filtering.
 */
export default async function TargetsPage({ params, searchParams }: TargetsPageProps) {
    const [{ benchmarkId }, searchParamsValues] = await Promise.all([params, searchParams])
    const destination = await resolveBenchmarkUrlKey(benchmarkId)
    if (!destination) notFound()

    permanentRedirect(withSearchParams(`/benchmarks/${destination.slug}`, buildSearchParams(searchParamsValues)))
}
