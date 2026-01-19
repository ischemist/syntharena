import * as modelData from '@/lib/services/data/model.data'
import { BreadcrumbShell } from '@/components/breadcrumb-shell'

export default async function ModelDetailBreadcrumb({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const modelInstance = await modelData.findModelInstanceBySlug(slug)

    return (
        <BreadcrumbShell
            items={[
                { label: 'Models', href: '/models' },
                { label: modelInstance.algorithm.name, href: `/models/${modelInstance.algorithm.slug}` },
                { label: modelInstance.name },
            ]}
        />
    )
}
