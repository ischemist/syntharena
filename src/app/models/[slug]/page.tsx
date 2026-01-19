import { Suspense, use } from 'react'
import type { Metadata } from 'next'

import * as modelData from '@/lib/services/data/model.data'

import { ModelDetailContent } from './_components/server/model-detail-content'
import { ModelDetailSkeleton } from './_components/skeletons'

interface ModelDetailPageProps {
    params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ModelDetailPageProps): Promise<Metadata> {
    const { slug } = await params
    try {
        const modelInstance = await modelData.findModelInstanceBySlug(slug)
        const version = `v${modelInstance.versionMajor}.${modelInstance.versionMinor}.${modelInstance.versionPatch}`
        // use family name in title
        return {
            title: `${modelInstance.family.name} ${version}`,
            description: modelInstance.description || `details and prediction runs for ${modelInstance.family.name}.`,
        }
    } catch {
        return {
            title: 'model not found',
            description: 'the requested model instance could not be found.',
        }
    }
}

export default function ModelDetailPage(props: ModelDetailPageProps) {
    const params = use(props.params)
    const { slug } = params

    return (
        <Suspense fallback={<ModelDetailSkeleton />}>
            <ModelDetailContent slug={slug} />
        </Suspense>
    )
}
