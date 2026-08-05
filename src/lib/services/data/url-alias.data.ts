/** Indexed URL-key lookups. Public-route resolution is the only consumer. */

import prisma from '@/lib/db'

export async function findBenchmarkUrlDestination(key: string) {
    // The public slug namespace is canonical. Resolve it before internal IDs so
    // malformed alias/catalog data cannot make a canonical public URL ambiguous.
    const canonicalSlug = await prisma.benchmarkSet.findUnique({
        where: { slug: key },
        select: { id: true, slug: true, name: true },
    })
    if (canonicalSlug) return canonicalSlug
    const canonicalId = await prisma.benchmarkSet.findUnique({
        where: { id: key },
        select: { id: true, slug: true, name: true },
    })
    if (canonicalId) return canonicalId
    const alias = await prisma.benchmarkUrlAlias.findUnique({
        where: { alias: key },
        select: { benchmarkSet: { select: { id: true, slug: true, name: true } } },
    })
    return alias?.benchmarkSet ?? null
}

export async function findBenchmarkTargetUrlDestination(benchmarkSetId: string, key: string) {
    const canonicalId = await prisma.benchmarkTarget.findFirst({
        where: { benchmarkSetId, id: key },
        select: { id: true, benchmarkSetId: true, targetId: true },
    })
    if (canonicalId) return canonicalId
    const externalId = await prisma.benchmarkTarget.findUnique({
        where: { benchmarkSetId_targetId: { benchmarkSetId, targetId: key } },
        select: { id: true, benchmarkSetId: true, targetId: true },
    })
    if (externalId) return externalId
    const alias = await prisma.benchmarkTargetUrlAlias.findUnique({
        where: { alias: key },
        select: {
            benchmarkTarget: { select: { id: true, benchmarkSetId: true, targetId: true } },
        },
    })
    return alias?.benchmarkTarget.benchmarkSetId === benchmarkSetId ? alias.benchmarkTarget : null
}

export async function findPredictionRunUrlDestination(key: string) {
    const select = {
        id: true,
        benchmarkSetId: true,
        benchmarkSet: { select: { slug: true } },
    } as const
    const canonical = await prisma.predictionRun.findUnique({
        where: { id: key },
        select,
    })
    if (canonical) return canonical
    const alias = await prisma.predictionRunUrlAlias.findUnique({
        where: { alias: key },
        select: {
            predictionRun: { select },
        },
    })
    return alias?.predictionRun ?? null
}
