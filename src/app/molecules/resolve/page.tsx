import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { getFirstSearchParamValue } from '../_lib/molecule-routing'
import { resolveMoleculeCanonicalInchiKey } from '@/lib/domains/molecules/view/molecule.view'

type ResolvePageProps = {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export const metadata: Metadata = {
    title: 'Resolve Molecule',
    robots: {
        index: false,
        follow: false,
    },
}

export default async function MoleculeResolvePage({ searchParams }: ResolvePageProps) {
    const resolvedSearchParams = await searchParams
    const rawQuery = getFirstSearchParamValue(resolvedSearchParams.q)

    if (!rawQuery.trim()) {
        redirect('/stocks')
    }

    let inchikey: string | null
    try {
        inchikey = await resolveMoleculeCanonicalInchiKey(rawQuery)
    } catch (error) {
        console.error('molecule resolve: failed to resolve query', {
            rawQuery,
            error,
        })
        notFound()
    }

    if (!inchikey) {
        console.error('molecule resolve: no canonical inchikey found', { rawQuery })
        notFound()
    }

    redirect(`/molecules/${inchikey}`)
}
