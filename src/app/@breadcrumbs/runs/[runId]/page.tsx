import { getPredictionRunBreadcrumbData } from '@/lib/services/view/prediction.view'
import { BreadcrumbShell } from '@/components/breadcrumb-shell'

export default async function RunDetailBreadcrumb({ params }: { params: Promise<{ runId: string }> }) {
    const { runId } = await params
    const { modelName, benchmarkName } = await getPredictionRunBreadcrumbData(runId)

    return <BreadcrumbShell items={[{ label: 'Runs', href: '/runs' }, { label: `${modelName} on ${benchmarkName}` }]} />
}
