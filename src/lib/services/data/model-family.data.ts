/**
 * data access layer for the ModelFamily model.
 */
import { unstable_cache as cache } from 'next/cache'

import prisma from '@/lib/db'

const tags = ['models', 'families', 'algorithms']

/** returns all model families for a given algorithm. */
async function _findModelFamiliesByAlgorithmId(algorithmId: string) {
    return prisma.modelFamily.findMany({
        where: { algorithmId },
        select: {
            id: true,
            algorithmId: true,
            name: true,
            slug: true,
            description: true,
            _count: { select: { instances: true } },
        },
        orderBy: { name: 'asc' },
    })
}
export const findModelFamiliesByAlgorithmId = cache(_findModelFamiliesByAlgorithmId, ['families-by-algorithm-id'], {
    tags,
})

/** returns all data for a single model family detail page. */
async function _findModelFamilyBySlug(slug: string) {
    const family = await prisma.modelFamily.findUnique({
        where: { slug },
        include: { algorithm: true },
    })
    if (!family) throw new Error(`model family with slug "${slug}" not found.`)
    return family
}
export const findModelFamilyBySlug = cache(_findModelFamilyBySlug, ['family-by-slug'], { tags })
