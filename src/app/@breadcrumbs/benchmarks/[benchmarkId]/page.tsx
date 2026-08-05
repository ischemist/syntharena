import { getBenchmarkById } from '@/lib/services/view/benchmark.view'
import { resolveBenchmarkUrlKey } from '@/lib/routing/url-resolver'
import { BreadcrumbShell } from '@/components/breadcrumb-shell'

export default async function BenchmarkDetailBreadcrumb({ params }: { params: Promise<{ benchmarkId: string }> }) {
    const { benchmarkId } = await params
    const destination = await resolveBenchmarkUrlKey(benchmarkId)
    if (!destination) throw new Error('benchmark not found.')
    const benchmark = await getBenchmarkById(destination.id)

    return <BreadcrumbShell items={[{ label: 'Benchmarks', href: '/benchmarks' }, { label: benchmark.name }]} />
}
