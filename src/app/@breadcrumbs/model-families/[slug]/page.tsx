import * as modelFamilyData from '@/lib/services/data/model-family.data'
import { BreadcrumbShell } from '@/components/breadcrumb-shell'

export default async function ModelFamilyDetailBreadcrumb({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const family = await modelFamilyData.findModelFamilyBySlug(slug)

    return (
        <BreadcrumbShell
            items={[
                { label: 'algorithms', href: '/algorithms' },
                {
                    label: family.algorithm.name,
                    href: `/algorithms/${family.algorithm.slug}`,
                },
                { label: family.name },
            ]}
        />
    )
}
