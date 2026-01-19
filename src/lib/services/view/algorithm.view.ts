/**
 * view model composition layer for algorithms.
 */
import type { Algorithm, AlgorithmListItem, ModelInstanceListItem } from '@/types'

import * as algorithmData from '../data/algorithm.data'
import * as modelData from '../data/model.data'

/** prepares the DTO for the main algorithm list page. */
export async function getAlgorithmListItems(): Promise<AlgorithmListItem[]> {
    const rawAlgorithms = await algorithmData.findAlgorithmListItems()
    return rawAlgorithms.map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        description: a.description,
        instanceCount: a._count.instances,
    }))
}

export interface AlgorithmDetailPageData {
    algorithm: Algorithm
    instances: ModelInstanceListItem[]
}

/** prepares the "mega-dto" for the algorithm detail page. */
export async function getAlgorithmDetailPageData(slug: string): Promise<AlgorithmDetailPageData> {
    const algorithm = await algorithmData.findAlgorithmBySlug(slug)
    const rawInstances = await modelData.findModelInstancesByAlgorithmId(algorithm.id)

    const instances = rawInstances.map((i) => ({
        ...i,
        versionPrerelease: i.versionPrerelease ?? undefined,
        runCount: i._count.runs,
    }))

    return { algorithm, instances }
}
