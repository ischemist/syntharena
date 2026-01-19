import { Suspense, use } from 'react'
import type { Metadata } from 'next'

import * as algorithmData from '@/lib/services/data/algorithm.data'

import { AlgorithmDetailContent } from './_components/server/algorithm-detail-content'
import { AlgorithmDetailSkeleton } from './_components/skeletons'

interface AlgorithmDetailPageProps {
    params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: AlgorithmDetailPageProps): Promise<Metadata> {
    const { slug } = await params
    try {
        const algorithm = await algorithmData.findAlgorithmBySlug(slug)
        return {
            title: algorithm.name,
            description: algorithm.description || `Details and model versions for ${algorithm.name}.`,
        }
    } catch {
        return {
            title: 'Algorithm Not Found',
            description: 'The requested algorithm could not be found.',
        }
    }
}

/**
 * Algorithm detail page showing algorithm metadata and all model versions.
 * Uses streaming with Suspense for instant layout render.
 */
export default function AlgorithmDetailPage(props: AlgorithmDetailPageProps) {
    const params = use(props.params)
    const { slug } = params

    return (
        <Suspense fallback={<AlgorithmDetailSkeleton />}>
            <AlgorithmDetailContent slug={slug} />
        </Suspense>
    )
}
