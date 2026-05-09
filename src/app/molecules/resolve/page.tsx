import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'

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
    const rawQuery =
        typeof resolvedSearchParams.q === 'string'
            ? resolvedSearchParams.q
            : Array.isArray(resolvedSearchParams.q)
              ? (resolvedSearchParams.q[0] ?? '')
              : ''

    if (!rawQuery.trim()) {
        redirect('/stocks')
    }

    const inchikey = await resolveMoleculeCanonicalInchiKey(rawQuery)
    if (!inchikey) {
        notFound()
    }

    redirect(`/molecules/${inchikey}`)
}
