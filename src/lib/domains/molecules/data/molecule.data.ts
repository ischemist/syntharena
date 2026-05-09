import { unstable_cache as cache } from 'next/cache'
import { Prisma } from '@prisma/client'

import prisma from '@/lib/db'

const moleculeDetailSelect = {
    id: true,
    inchikey: true,
    smiles: true,
    _count: {
        select: {
            stockItems: true,
            benchmarkTargets: true,
            routeNodes: true,
        },
    },
    stockItems: {
        orderBy: {
            stock: {
                name: 'asc',
            },
        },
        select: {
            id: true,
            ppg: true,
            source: true,
            leadTime: true,
            link: true,
            stock: {
                select: {
                    id: true,
                    name: true,
                    description: true,
                },
            },
        },
    },
} satisfies Prisma.MoleculeSelect

export type MoleculeDetailRow = Prisma.MoleculeGetPayload<{
    select: typeof moleculeDetailSelect
}>

async function _findMoleculeByInchiKey(inchikey: string): Promise<MoleculeDetailRow | null> {
    return prisma.molecule.findUnique({
        where: { inchikey },
        select: moleculeDetailSelect,
    })
}
export const findMoleculeByInchiKey = cache(_findMoleculeByInchiKey, ['molecule-by-inchikey'], {
    tags: ['molecules', 'stocks'],
})

async function _findCanonicalInchiKeyByInchiKey(inchikey: string): Promise<string | null> {
    const molecule = await prisma.molecule.findUnique({
        where: { inchikey },
        select: { inchikey: true },
    })

    return molecule?.inchikey ?? null
}
export const findCanonicalInchiKeyByInchiKey = cache(_findCanonicalInchiKeyByInchiKey, ['canonical-inchikey'], {
    tags: ['molecules'],
})

async function _findCanonicalInchiKeysBySmiles(smiles: string): Promise<string[]> {
    const molecules = await prisma.molecule.findMany({
        where: { smiles },
        orderBy: { inchikey: 'asc' },
        select: { inchikey: true },
        // Fetch at most two matches so the caller can distinguish unique from ambiguous SMILES lookups.
        take: 2,
    })

    return molecules.map((molecule) => molecule.inchikey)
}
export const findCanonicalInchiKeysBySmiles = cache(
    _findCanonicalInchiKeysBySmiles,
    ['canonical-inchikeys-by-smiles'],
    {
        tags: ['molecules'],
    }
)

async function _countIndexedMolecules(): Promise<number> {
    return prisma.molecule.count({
        where: {
            stockItems: {
                some: {},
            },
        },
    })
}
export const countIndexedMolecules = cache(_countIndexedMolecules, ['indexed-molecule-count'], {
    tags: ['molecules', 'stocks'],
})

async function _findIndexedMoleculesForSitemap(limit: number, offset: number): Promise<Array<{ inchikey: string }>> {
    return prisma.molecule.findMany({
        where: {
            stockItems: {
                some: {},
            },
        },
        orderBy: {
            inchikey: 'asc',
        },
        select: {
            inchikey: true,
        },
        take: limit,
        skip: offset,
    })
}
export const findIndexedMoleculesForSitemap = cache(
    _findIndexedMoleculesForSitemap,
    ['indexed-molecules-for-sitemap'],
    {
        tags: ['molecules', 'stocks'],
    }
)
