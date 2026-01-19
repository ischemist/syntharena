import * as algorithmData from '@/lib/services/data/algorithm.data'
import { BreadcrumbShell } from '@/components/breadcrumb-shell'

export default async function AlgorithmDetailBreadcrumb({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const algorithm = await algorithmData.findAlgorithmBySlug(slug)

    return <BreadcrumbShell items={[{ label: 'Models', href: '/models' }, { label: algorithm.name }]} />
}
