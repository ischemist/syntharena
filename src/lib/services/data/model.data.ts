/**
 * data access layer for the ModelInstance model.
 */
import { unstable_cache as cache } from 'next/cache'
import { Prisma } from '@prisma/client'

import prisma from '@/lib/db'

const tags = ['models', 'algorithms']

/** returns all model instance versions for a given algorithm. */
async function _findModelInstancesByAlgorithmId(algorithmId: string) {
    return prisma.modelInstance.findMany({
        where: { algorithmId },
        select: {
            id: true,
            algorithmId: true,
            name: true,
            slug: true,
            description: true,
            versionMajor: true,
            versionMinor: true,
            versionPatch: true,
            versionPrerelease: true,
            metadata: true,
            _count: { select: { runs: true } },
        },
        orderBy: [
            { versionMajor: 'desc' },
            { versionMinor: 'desc' },
            { versionPatch: 'desc' },
            // nulls last for prerelease so '1.0.0' comes before '1.0.0-alpha'
            { versionPrerelease: { sort: 'desc', nulls: 'last' } },
        ],
    })
}
export const findModelInstancesByAlgorithmId = cache(_findModelInstancesByAlgorithmId, ['models-by-algorithm-id'], {
    tags,
})
export type ModelInstanceListItemPayload = Prisma.PromiseReturnType<typeof _findModelInstancesByAlgorithmId>[0]

/** returns all data for a single model instance detail page. */
async function _findModelInstanceBySlug(slug: string) {
    const modelInstance = await prisma.modelInstance.findUnique({
        where: { slug },
        include: { algorithm: true },
    })
    if (!modelInstance) throw new Error(`model instance with slug "${slug}" not found.`)
    return modelInstance
}
export const findModelInstanceBySlug = cache(_findModelInstanceBySlug, ['model-by-slug'], { tags })
