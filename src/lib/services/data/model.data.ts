/**
 * data access layer for the ModelInstance model.
 */
import { unstable_cache as cache } from 'next/cache'
import { Prisma } from '@prisma/client'

import prisma from '@/lib/db'

const tags = ['models', 'families']

/** [RENAMED] returns all model instance versions for a given model family. */
async function _findModelInstancesByFamilyId(modelFamilyId: string) {
    return prisma.modelInstance.findMany({
        where: { modelFamilyId },
        select: {
            id: true,
            modelFamilyId: true,
            slug: true,
            description: true,
            versionMajor: true,
            versionMinor: true,
            versionPatch: true,
            versionPrerelease: true,
            metadata: true,
            createdAt: true,
            _count: { select: { runs: true } },
        },
        orderBy: [
            { versionMajor: 'desc' },
            { versionMinor: 'desc' },
            { versionPatch: 'desc' },
            { versionPrerelease: { sort: 'desc', nulls: 'last' } },
        ],
    })
}
export const findModelInstancesByFamilyId = cache(_findModelInstancesByFamilyId, ['models-by-family-id'], {
    tags,
})
export type ModelInstanceListItemPayload = Prisma.PromiseReturnType<typeof _findModelInstancesByFamilyId>[0]

/** returns all data for a single model instance detail page. */
async function _findModelInstanceBySlug(slug: string) {
    const modelInstance = await prisma.modelInstance.findUnique({
        where: { slug },
        include: { family: { include: { algorithm: true } } },
    })
    if (!modelInstance) throw new Error(`model instance with slug "${slug}" not found.`)
    return modelInstance
}
export const findModelInstanceBySlug = cache(_findModelInstanceBySlug, ['model-by-slug'], { tags })
