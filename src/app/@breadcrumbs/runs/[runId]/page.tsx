import { getPredictionRunBreadcrumbData } from '@/lib/services/view/prediction.view'
import { resolvePredictionRunUrlKey } from '@/lib/routing/url-resolver'
import { BreadcrumbShell } from '@/components/breadcrumb-shell'

export default async function RunDetailBreadcrumb({ params }: { params: Promise<{ runId: string }> }) {
    const { runId } = await params
    const destination = await resolvePredictionRunUrlKey(runId)
    if (!destination) throw new Error('prediction run not found for breadcrumb.')
    const { modelName, benchmarkName } = await getPredictionRunBreadcrumbData(destination.id)

    return <BreadcrumbShell items={[{ label: 'Runs', href: '/runs' }, { label: `${modelName} on ${benchmarkName}` }]} />
}
