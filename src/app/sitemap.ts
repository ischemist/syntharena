import type { MetadataRoute } from 'next'

import { getSiteUrl } from '@/lib/constants'
import { getStocks } from '@/lib/services/view/stock.view'

const STATIC_ROUTES: MetadataRoute.Sitemap = [
    { url: getSiteUrl('/'), changeFrequency: 'weekly', priority: 1.0 },
    { url: getSiteUrl('/stocks'), changeFrequency: 'weekly', priority: 0.9 },
    { url: getSiteUrl('/benchmarks'), changeFrequency: 'weekly', priority: 0.9 },
    { url: getSiteUrl('/runs'), changeFrequency: 'weekly', priority: 0.8 },
    { url: getSiteUrl('/leaderboard'), changeFrequency: 'daily', priority: 0.9 },
    { url: getSiteUrl('/algorithms'), changeFrequency: 'weekly', priority: 0.8 },
    { url: getSiteUrl('/docs'), changeFrequency: 'monthly', priority: 0.7 },
    { url: getSiteUrl('/docs/how-it-works'), changeFrequency: 'monthly', priority: 0.7 },
    { url: getSiteUrl('/docs/benchmarks'), changeFrequency: 'monthly', priority: 0.7 },
    { url: getSiteUrl('/docs/metrics'), changeFrequency: 'monthly', priority: 0.7 },
    { url: getSiteUrl('/thesis'), changeFrequency: 'monthly', priority: 0.6 },
    { url: getSiteUrl('/changelog'), changeFrequency: 'weekly', priority: 0.6 },
    { url: getSiteUrl('/roadmap'), changeFrequency: 'monthly', priority: 0.5 },
    { url: getSiteUrl('/submit-results'), changeFrequency: 'monthly', priority: 0.6 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    let stocks: Awaited<ReturnType<typeof getStocks>> = []
    try {
        stocks = await getStocks()
    } catch (error) {
        console.error('sitemap: failed to fetch stocks', { error })
    }

    const stockRoutes: MetadataRoute.Sitemap = stocks.map((stock) => ({
        url: getSiteUrl(`/stocks/${stock.id}`),
        changeFrequency: 'weekly',
        priority: 0.8,
    }))

    return [...STATIC_ROUTES, ...stockRoutes]
}
