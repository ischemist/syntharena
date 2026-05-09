/**
 * Application constants and configuration.
 */

export const SITE_URL = 'https://syntharena.ischemist.com'
export const ISCHEMIST_URL = 'https://ischemist.com'
export const NEWSLETTER_URL = `${ISCHEMIST_URL}/newsletter`
export const STATUS_URL = 'https://status.ischemist.com'
export const MOLECULE_SITEMAP_PAGE_SIZE = 50_000

export function getSiteUrl(path: string = '/') {
    return new URL(path, SITE_URL).toString()
}

/**
 * Benchmark IDs used for algorithm highlight metrics on detail pages.
 * These benchmarks are shown in the "Best Performance" section.
 */
export const HIGHLIGHT_BENCHMARK_IDS = [
    'cmisc0flu0000boddjstwifeo', // mkt-cnv-160
    'cmisc0cnd0000a8dd4g4pdf0s', // mkt-cnv-500
] as const

/**
 * Metrics to display in algorithm highlight summaries.
 * These correspond to Top-K accuracy metrics computed from ground truth routes.
 */
export const HIGHLIGHT_METRICS = ['Top-1', 'Top-10'] as const
