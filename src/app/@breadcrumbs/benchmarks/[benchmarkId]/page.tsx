import { getBenchmarkById } from '@/lib/services/benchmark.service'
import { BreadcrumbShell } from '@/components/breadcrumb-shell'

export default async function BenchmarkDetailBreadcrumb({ params }: { params: Promise<{ benchmarkId: string }> }) {
    const { benchmarkId } = await params
    const benchmark = await getBenchmarkById(benchmarkId)

    return <BreadcrumbShell items={[{ label: 'Benchmarks', href: '/benchmarks' }, { label: benchmark.name }]} />
}
