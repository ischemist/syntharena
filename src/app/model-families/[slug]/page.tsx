import { Suspense, use } from 'react'
import type { Metadata } from 'next'

import * as modelFamilyData from '@/lib/services/data/model-family.data'

import { ModelFamilyDetailContent } from './_components/server/model-family-detail-content'
import { ModelFamilyDetailSkeleton } from './_components/skeletons'

interface ModelFamilyDetailPageProps {
    params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ModelFamilyDetailPageProps): Promise<Metadata> {
    const { slug } = await params
    try {
        const family = await modelFamilyData.findModelFamilyBySlug(slug)
        return {
            title: family.name,
            description: family.description || `details and versions for the ${family.name} model family.`,
        }
    } catch {
        return {
            title: 'model family not found',
            description: 'the requested model family could not be found.',
        }
    }
}

export default function ModelFamilyDetailPage(props: ModelFamilyDetailPageProps) {
    const params = use(props.params)
    return (
        <Suspense fallback={<ModelFamilyDetailSkeleton />}>
            <ModelFamilyDetailContent slug={params.slug} />
        </Suspense>
    )
}
