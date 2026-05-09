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

export async function findMoleculeByInchiKey(inchikey: string): Promise<MoleculeDetailRow | null> {
    return prisma.molecule.findUnique({
        where: { inchikey },
        select: moleculeDetailSelect,
    })
}

export async function findCanonicalInchiKeyByInchiKey(inchikey: string): Promise<string | null> {
    const molecule = await prisma.molecule.findUnique({
        where: { inchikey },
        select: { inchikey: true },
    })

    return molecule?.inchikey ?? null
}

export async function findCanonicalInchiKeysBySmiles(smiles: string): Promise<string[]> {
    const molecules = await prisma.molecule.findMany({
        where: { smiles },
        orderBy: { inchikey: 'asc' },
        select: { inchikey: true },
        take: 2,
    })

    return molecules.map((molecule) => molecule.inchikey)
}

export async function countIndexedMolecules(): Promise<number> {
    return prisma.molecule.count({
        where: {
            stockItems: {
                some: {},
            },
        },
    })
}

export async function findIndexedMoleculesForSitemap(
    limit: number,
    offset: number
): Promise<Array<{ inchikey: string }>> {
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
