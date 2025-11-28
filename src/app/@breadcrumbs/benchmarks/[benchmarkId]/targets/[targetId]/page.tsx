import { getBenchmarkById, getTargetById } from '@/lib/services/benchmark.service'
import { BreadcrumbShell } from '@/components/breadcrumb-shell'

export default async function TargetDetailBreadcrumb({
    params,
}: {
    params: Promise<{ benchmarkId: string; targetId: string }>
}) {
    const { benchmarkId, targetId } = await params
    const [benchmark, target] = await Promise.all([getBenchmarkById(benchmarkId), getTargetById(targetId)])

    return (
        <BreadcrumbShell
            items={[
                { label: 'Benchmarks', href: '/benchmarks' },
                { label: benchmark.name, href: `/benchmarks/${benchmarkId}` },
                { label: target.targetId },
            ]}
        />
    )
}
