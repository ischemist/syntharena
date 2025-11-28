import { getPredictionRunById } from '@/lib/services/prediction.service'
import { BreadcrumbShell } from '@/components/breadcrumb-shell'

export default async function RunDetailBreadcrumb({ params }: { params: Promise<{ runId: string }> }) {
    const { runId } = await params
    const run = await getPredictionRunById(runId)

    const modelName = run.modelInstance.name || run.modelInstance.algorithm.name
    const benchmarkName = run.benchmarkSet.name

    return <BreadcrumbShell items={[{ label: 'Runs', href: '/runs' }, { label: `${modelName} on ${benchmarkName}` }]} />
}
