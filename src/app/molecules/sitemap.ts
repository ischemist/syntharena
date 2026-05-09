import type { MetadataRoute } from 'next'

import { MOLECULE_SITEMAP_PAGE_SIZE, getSiteUrl } from '@/lib/constants'
import { countIndexedMolecules, findIndexedMoleculesForSitemap } from '@/lib/domains/molecules/data/molecule.data'

export const dynamic = 'force-dynamic'

export async function generateSitemaps() {
    const totalIndexedMolecules = await countIndexedMolecules()
    const sitemapCount = Math.max(1, Math.ceil(totalIndexedMolecules / MOLECULE_SITEMAP_PAGE_SIZE))

    return Array.from({ length: sitemapCount }, (_, id) => ({ id }))
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
    const resolvedId = Number(await props.id)
    if (!Number.isInteger(resolvedId) || resolvedId < 0) {
        return []
    }

    const offset = resolvedId * MOLECULE_SITEMAP_PAGE_SIZE
    const molecules = await findIndexedMoleculesForSitemap(MOLECULE_SITEMAP_PAGE_SIZE, offset)

    return molecules.map((molecule) => ({
        url: getSiteUrl(`/molecules/${molecule.inchikey}`),
        changeFrequency: 'weekly',
        priority: 0.7,
    }))
}
