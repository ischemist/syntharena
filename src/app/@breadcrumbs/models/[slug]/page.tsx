import * as modelData from '@/lib/services/data/model.data'
import { BreadcrumbShell } from '@/components/breadcrumb-shell'

function formatVersion(instance: {
    versionMajor: number
    versionMinor: number
    versionPatch: number
    versionPrerelease: string | null
}): string {
    const base = `v${instance.versionMajor}.${instance.versionMinor}.${instance.versionPatch}`
    return instance.versionPrerelease ? `${base}-${instance.versionPrerelease}` : base
}

export default async function ModelDetailBreadcrumb({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const modelInstance = await modelData.findModelInstanceBySlug(slug)

    return (
        <BreadcrumbShell
            items={[
                { label: 'algorithms', href: '/algorithms' },
                {
                    label: modelInstance.family.algorithm.name,
                    href: `/algorithms/${modelInstance.family.algorithm.slug}`,
                },
                { label: modelInstance.family.name, href: `/families/${modelInstance.family.slug}` },
                { label: formatVersion(modelInstance) },
            ]}
        />
    )
}
