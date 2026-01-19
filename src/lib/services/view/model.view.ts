/**
 * view model composition layer for model instances.
 */
import type { ModelInstance, PredictionRunWithStats } from '@/types'

import * as modelData from '../data/model.data'
import { getPredictionRuns } from './prediction.view'

export interface ModelInstanceDetailPageData {
    modelInstance: ModelInstance & { algorithm: NonNullable<ModelInstance['algorithm']> }
    runs: PredictionRunWithStats[]
}

/** prepares the "mega-dto" for the model instance detail page. */
export async function getModelInstanceDetailPageData(slug: string): Promise<ModelInstanceDetailPageData> {
    const modelInstance = await modelData.findModelInstanceBySlug(slug)
    const runs = await getPredictionRuns(undefined, modelInstance.id)

    return {
        modelInstance: {
            ...modelInstance,
            versionPrerelease: modelInstance.versionPrerelease ?? undefined,
        },
        runs,
    }
}
