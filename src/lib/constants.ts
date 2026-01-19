/**
 * Application constants and configuration.
 */

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
