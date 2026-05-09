import type { MetadataRoute } from 'next'

import { MOLECULE_SITEMAP_PAGE_SIZE, getSiteUrl } from '@/lib/constants'
import { countIndexedMolecules, findIndexedMoleculesForSitemap } from '@/lib/domains/molecules/data/molecule.data'

export async function generateSitemaps() {
    let totalIndexedMolecules = 0
    try {
        totalIndexedMolecules = await countIndexedMolecules()
    } catch (error) {
        console.error('molecule sitemap: failed to count indexed molecules', { error })
    }

    const sitemapCount = Math.max(1, Math.ceil(totalIndexedMolecules / MOLECULE_SITEMAP_PAGE_SIZE))

    return Array.from({ length: sitemapCount }, (_, id) => ({ id }))
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
    const resolvedId = Number(await props.id)
    if (!Number.isInteger(resolvedId) || resolvedId < 0) {
        return []
    }

    const offset = resolvedId * MOLECULE_SITEMAP_PAGE_SIZE
    try {
        const molecules = await findIndexedMoleculesForSitemap(MOLECULE_SITEMAP_PAGE_SIZE, offset)
        const moleculeRoutes: MetadataRoute.Sitemap = molecules.map((molecule) => ({
            url: getSiteUrl(`/molecules/${molecule.inchikey}`),
            changeFrequency: 'weekly',
            priority: 0.7,
        }))

        return moleculeRoutes
    } catch (error) {
        console.error('molecule sitemap: failed to fetch molecules', {
            resolvedId,
            offset,
            error,
        })
        return []
    }
}
