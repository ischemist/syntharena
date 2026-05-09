import { getMoleculeDetailPageData } from '@/lib/domains/molecules/view/molecule.view'
import { normalizeInchiKeyCandidate } from '@/lib/domains/molecules/logic/molecule-query.logic'
import { BreadcrumbShell } from '@/components/breadcrumb-shell'

export default async function MoleculeDetailBreadcrumb({ params }: { params: Promise<{ inchikey: string }> }) {
    const { inchikey: rawInchikey } = await params
    const normalizedInchikey = normalizeInchiKeyCandidate(rawInchikey) ?? rawInchikey

    let label = normalizedInchikey
    try {
        const molecule = await getMoleculeDetailPageData(normalizedInchikey)
        label = molecule.inchikey
    } catch (error) {
        console.error('molecule breadcrumb: failed to load molecule details', {
            normalizedInchikey,
            error,
        })
        // Keep the normalized input as the last-resort label for invalid or missing molecules.
    }

    return <BreadcrumbShell items={[{ label: 'Molecules' }, { label }]} />
}
