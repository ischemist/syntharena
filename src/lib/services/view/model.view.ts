/**
 * view model composition layer for model instances.
 */
import type { ModelInstance } from '@/types' // No longer need Algorithm here
import type { PredictionRunWithStats } from '@/types'

import * as modelData from '../data/model.data'
import { getPredictionRuns } from './prediction.view'

export interface ModelInstanceDetailPageData {
    modelInstance: ModelInstance & { family: { algorithm: { name: string; slug: string } } }
    runs: PredictionRunWithStats[]
}

/** prepares the "mega-dto" for the model instance detail page. */
export async function getModelInstanceDetailPageData(slug: string): Promise<ModelInstanceDetailPageData> {
    const modelInstance = await modelData.findModelInstanceBySlug(slug)
    const runs = await getPredictionRuns(undefined, modelInstance.id)

    return {
        // the payload from the data layer is now nested, so we just pass it through
        modelInstance: {
            ...modelInstance,
            versionPrerelease: modelInstance.versionPrerelease ?? undefined,
        },
        runs,
    }
}
