import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { getSiteUrl } from '@/lib/constants'
import { getMoleculeDetailPageData } from '@/lib/domains/molecules/view/molecule.view'
import { normalizeMoleculeRouteInchiKey } from '../_lib/molecule-routing'
import { MoleculeDetailContent } from './_components/server/molecule-detail-content'

type PageProps = {
    params: Promise<{ inchikey: string }>
}

const MOLECULE_NOT_FOUND_METADATA: Metadata = {
    title: 'Molecule Not Found',
    description: 'The requested molecule could not be found in SynthArena.',
}

function buildMoleculeDescription(stockCount: number, buyableStockCount: number, inchikey: string): string {
    if (stockCount === 0) {
        return `${inchikey} is a known SynthArena molecule, but it is not currently present in any indexed stock library.`
    }

    const libraryLabel = stockCount === 1 ? 'stock library' : 'stock libraries'
    const buyableClause =
        buyableStockCount === 0
            ? 'no vendor metadata loaded yet'
            : `${buyableStockCount.toLocaleString()} with vendor metadata`

    return `${inchikey} appears in ${stockCount.toLocaleString()} ${libraryLabel} on SynthArena, with ${buyableClause}.`
}

function getNormalizedInchiKeyOr404(rawInchikey: string): string {
    const normalizedInchikey = normalizeMoleculeRouteInchiKey(rawInchikey)
    if (!normalizedInchikey) {
        notFound()
    }

    return normalizedInchikey
}
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { inchikey: rawInchikey } = await params
    const normalizedInchikey = normalizeMoleculeRouteInchiKey(rawInchikey)

    if (!normalizedInchikey) {
        return MOLECULE_NOT_FOUND_METADATA
    }

    try {
        const molecule = await getMoleculeDetailPageData(normalizedInchikey)

        return {
            title: normalizedInchikey,
            description: buildMoleculeDescription(molecule.stockCount, molecule.buyableStockCount, normalizedInchikey),
            alternates: {
                canonical: `/molecules/${normalizedInchikey}`,
            },
        }
    } catch (error) {
        console.error('molecule page metadata: failed to load molecule details', {
            normalizedInchikey,
            error,
        })
        return MOLECULE_NOT_FOUND_METADATA
    }
}

export default async function MoleculeDetailPage({ params }: PageProps) {
    const { inchikey: rawInchikey } = await params
    const normalizedInchikey = getNormalizedInchiKeyOr404(rawInchikey)

    if (normalizedInchikey !== rawInchikey) {
        redirect(`/molecules/${normalizedInchikey}`)
    }

    let molecule
    try {
        molecule = await getMoleculeDetailPageData(normalizedInchikey)
    } catch (error) {
        console.error('molecule page: failed to load molecule details', {
            normalizedInchikey,
            error,
        })
        notFound()
    }

    const canonicalUrl = getSiteUrl(`/molecules/${molecule.inchikey}`)

    const description = buildMoleculeDescription(molecule.stockCount, molecule.buyableStockCount, molecule.inchikey)

    return <MoleculeDetailContent molecule={molecule} canonicalUrl={canonicalUrl} description={description} />
}
