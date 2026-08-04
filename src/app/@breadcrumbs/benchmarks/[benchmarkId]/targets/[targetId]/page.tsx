import { getBenchmarkById, getTargetById } from '@/lib/services/view/benchmark.view'
import { resolveBenchmarkTargetUrlKey, resolveBenchmarkUrlKey } from '@/lib/routing/url-resolver'
import { BreadcrumbShell } from '@/components/breadcrumb-shell'

export default async function TargetDetailBreadcrumb({
    params,
}: {
    params: Promise<{ benchmarkId: string; targetId: string }>
}) {
    const { benchmarkId, targetId } = await params
    const benchmarkDestination = await resolveBenchmarkUrlKey(benchmarkId)
    if (!benchmarkDestination) throw new Error('benchmark not found.')
    const targetDestination = await resolveBenchmarkTargetUrlKey(benchmarkDestination.id, targetId)
    if (!targetDestination) throw new Error('benchmark target not found.')
    const [benchmark, target] = await Promise.all([
        getBenchmarkById(benchmarkDestination.id),
        getTargetById(targetDestination.id),
    ])

    return (
        <BreadcrumbShell
            items={[
                { label: 'Benchmarks', href: '/benchmarks' },
                { label: benchmark.name, href: `/benchmarks/${benchmarkDestination.slug}` },
                { label: target.targetId },
            ]}
        />
    )
}
