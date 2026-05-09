import type { MetadataRoute } from 'next'

import { MOLECULE_SITEMAP_PAGE_SIZE, getSiteUrl } from '@/lib/constants'
import { countIndexedMolecules } from '@/lib/domains/molecules/data/molecule.data'

export default async function robots(): Promise<MetadataRoute.Robots> {
    let moleculeSitemapCount = 1
    try {
        const totalIndexedMolecules = await countIndexedMolecules()
        moleculeSitemapCount = Math.max(1, Math.ceil(totalIndexedMolecules / MOLECULE_SITEMAP_PAGE_SIZE))
    } catch (error) {
        console.error('robots: failed to count indexed molecules', { error })
    }

    const sitemapUrls = [
        getSiteUrl('/sitemap.xml'),
        ...Array.from({ length: moleculeSitemapCount }, (_, id) => getSiteUrl(`/molecules/sitemap/${id}.xml`)),
    ]

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/health', '/molecules/resolve'],
        },
        sitemap: sitemapUrls,
    }
}
