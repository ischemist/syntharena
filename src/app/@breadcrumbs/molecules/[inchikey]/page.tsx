import { getMoleculeDetailPageData } from '@/lib/domains/molecules/view/molecule.view'
import { BreadcrumbShell } from '@/components/breadcrumb-shell'
import { normalizeMoleculeRouteInchiKey } from '@/app/molecules/_lib/molecule-routing'

export default async function MoleculeDetailBreadcrumb({ params }: { params: Promise<{ inchikey: string }> }) {
    const { inchikey: rawInchikey } = await params
    const normalizedInchikey = normalizeMoleculeRouteInchiKey(rawInchikey) ?? rawInchikey

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
