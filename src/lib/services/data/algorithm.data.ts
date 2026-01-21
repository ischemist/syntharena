/**
 * data access layer for the Algorithm model.
 */
import { unstable_cache as cache } from 'next/cache'
import { Prisma } from '@prisma/client'

import prisma from '@/lib/db'

const tags = ['algorithms']

/** returns data needed for the main algorithm list page. */
async function _findAlgorithmListItems() {
    return prisma.algorithm.findMany({
        select: {
            id: true,
            name: true,
            slug: true,
            description: true,
        },
        orderBy: { name: 'asc' },
    })
}
export const findAlgorithmListItems = cache(_findAlgorithmListItems, ['algorithm-list-items'], { tags })
export type AlgorithmListItemPayload = Prisma.PromiseReturnType<typeof _findAlgorithmListItems>

/** efficiently computes total instance counts for all algorithms. */
async function _getAlgorithmInstanceCountsMap(): Promise<Record<string, number>> {
    const familiesWithCounts = await prisma.modelFamily.findMany({
        select: {
            algorithmId: true,
            _count: { select: { instances: true } },
        },
    })

    const countsMap: Record<string, number> = {}
    for (const family of familiesWithCounts) {
        countsMap[family.algorithmId] = (countsMap[family.algorithmId] ?? 0) + family._count.instances
    }
    return countsMap
}
export const getAlgorithmInstanceCountsMap = cache(_getAlgorithmInstanceCountsMap, ['algorithm-instance-counts-map'], {
    tags: [...tags, 'models', 'families'],
})

/** returns all data for a single algorithm detail page. */
async function _findAlgorithmBySlug(slug: string) {
    const algorithm = await prisma.algorithm.findUnique({
        where: { slug },
    })
    if (!algorithm) throw new Error(`algorithm with slug "${slug}" not found.`)
    return algorithm
}
export const findAlgorithmBySlug = cache(_findAlgorithmBySlug, ['algorithm-by-slug'], { tags })
