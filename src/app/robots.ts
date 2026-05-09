import type { MetadataRoute } from 'next'

import { MOLECULE_SITEMAP_PAGE_SIZE, getSiteUrl } from '@/lib/constants'
import { countIndexedMolecules } from '@/lib/domains/molecules/data/molecule.data'

export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
    const totalIndexedMolecules = await countIndexedMolecules()
    const moleculeSitemapCount = Math.max(1, Math.ceil(totalIndexedMolecules / MOLECULE_SITEMAP_PAGE_SIZE))

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/health', '/molecules/resolve'],
        },
        sitemap: [
            getSiteUrl('/sitemap.xml'),
            ...Array.from({ length: moleculeSitemapCount }, (_, id) => getSiteUrl(`/molecules/sitemap/${id}.xml`)),
        ],
    }
}
