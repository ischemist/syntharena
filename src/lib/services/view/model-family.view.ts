/**
 * view model composition layer for model families.
 */
import type { ModelFamily, ModelInstanceListItem } from '@/types'

import * as modelFamilyData from '../data/model-family.data'
import * as modelData from '../data/model.data'

export interface ModelFamilyDetailPageData {
    family: ModelFamily & { algorithm: NonNullable<ModelFamily['algorithm']> }
    instances: ModelInstanceListItem[]
}

/** prepares the "mega-dto" for the model family detail page. */
export async function getModelFamilyDetailPageData(slug: string): Promise<ModelFamilyDetailPageData> {
    const family = await modelFamilyData.findModelFamilyBySlug(slug)

    const rawInstances = await modelData.findModelInstancesByFamilyId(family.id)

    const instances: ModelInstanceListItem[] = rawInstances.map((i) => ({
        ...i,
        modelFamilyId: family.id, // ensure it's here, satisfies type
        versionPrerelease: i.versionPrerelease ?? undefined,
        runCount: i._count.runs,
    }))

    return {
        family: {
            ...family,
            description: family.description ?? undefined,
        },
        instances,
    }
}
