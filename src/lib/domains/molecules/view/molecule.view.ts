import { cache } from 'react'
import type { VendorSource } from '@/types'

import * as moleculeData from '../data/molecule.data'
import { parseMoleculeLookupQuery } from '../logic/molecule-query.logic'

export interface MoleculeDetailPageData {
    id: string
    inchikey: string
    smiles: string
    stockCount: number
    benchmarkTargetCount: number
    routeNodeCount: number
    buyableStockCount: number
    stockEntries: Array<{
        id: string
        source?: VendorSource | null
        ppg?: number | null
        leadTime?: string | null
        link?: string | null
        stock: {
            id: string
            name: string
            description?: string | null
        }
    }>
}

export const getMoleculeDetailPageData = cache(async (inchikey: string): Promise<MoleculeDetailPageData> => {
    const molecule = await moleculeData.findMoleculeByInchiKey(inchikey)
    if (!molecule) {
        throw new Error('Molecule not found')
    }

    const buyableStockCount = molecule.stockItems.filter(
        (stockItem) => stockItem.source != null && stockItem.ppg != null
    ).length

    return {
        id: molecule.id,
        inchikey: molecule.inchikey,
        smiles: molecule.smiles,
        stockCount: molecule._count.stockItems,
        benchmarkTargetCount: molecule._count.benchmarkTargets,
        routeNodeCount: molecule._count.routeNodes,
        buyableStockCount,
        stockEntries: molecule.stockItems.map((stockItem) => ({
            id: stockItem.id,
            source: stockItem.source,
            ppg: stockItem.ppg,
            leadTime: stockItem.leadTime,
            link: stockItem.link,
            stock: {
                id: stockItem.stock.id,
                name: stockItem.stock.name,
                description: stockItem.stock.description,
            },
        })),
    }
})

/**
 * Resolves a canonical molecule page from either:
 * - an exact InChIKey, or
 * - an exact canonical SMILES string already stored in the database.
 *
 * Non-canonical/equivalent SMILES representations are intentionally out of scope for now.
 */
export async function resolveMoleculeCanonicalInchiKey(rawQuery: string): Promise<string | null> {
    const parsedQuery = parseMoleculeLookupQuery(rawQuery)

    switch (parsedQuery.kind) {
        case 'empty':
            return null
        case 'inchikey':
            return moleculeData.findCanonicalInchiKeyByInchiKey(parsedQuery.inchikey)
        case 'smiles': {
            const matches = await moleculeData.findCanonicalInchiKeysBySmiles(parsedQuery.smiles)
            return matches.length === 1 ? matches[0] : null
        }
    }
}
