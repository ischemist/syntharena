import type { MetricEstimate, MetricResult, StratifiedMetric } from '@/types'

const TIER_RATE_PATTERN = /^tier_(\d+)_validity_rate$/
const SOLV_RATE_PATTERN = /^solv_(\d+)\[(.+)]_rate$/
const TOP_K_PATTERN = /^acceptable_reconstruction_top_(\d+)\[.+]$/

export function tierValidityRateKey(tier: number): string {
    return `tier_${tier}_validity_rate`
}

export function solvRateKey(tier: number, label: string): string {
    return `solv_${tier}[${label}]_rate`
}

export function parseSolvRateKey(key: string): { tier: number; label: string } | null {
    const match = SOLV_RATE_PATTERN.exec(key)
    return match ? { tier: Number(match[1]), label: match[2] } : null
}

export function topKFromMetricKey(key: string): number | null {
    const match = TOP_K_PATTERN.exec(key)
    return match ? Number(match[1]) : null
}

export function displayMetricName(key: string): string {
    const tier = TIER_RATE_PATTERN.exec(key)
    if (tier) return `Tier-${tier[1]} valid`
    const solv = parseSolvRateKey(key)
    if (solv) return `Solv-${solv.tier}[${solv.label}]`
    const topK = topKFromMetricKey(key)
    if (topK !== null) return `Top-${topK}`
    return key
}

export function displaySolvStatus(tier: number, label: string, passed: boolean): string {
    return `${displayMetricName(solvRateKey(tier, label))} ${passed ? 'pass' : 'fail'}`
}

export function metricResultFromEstimate(metric: MetricEstimate): MetricResult {
    return {
        value: metric.value,
        ciLower: metric.ciLower ?? metric.value,
        ciUpper: metric.ciUpper ?? metric.value,
        nSamples: metric.nSamples,
        reliability: {
            code: metric.reliabilityCode ?? 'LOW_N',
            message: metric.reliabilityMessage ?? 'RetroCast did not report reliability for this metric.',
        },
    }
}

export function buildStratifiedMetric(key: string, metrics: MetricEstimate[]): StratifiedMetric | null {
    const forKey = metrics.filter((metric) => metric.metricKey === key)
    const overall = forKey.find((metric) => metric.stratum === '')
    if (!overall) return null
    const byStratum: Record<string, MetricResult> = {}
    for (const metric of forKey) {
        if (metric.stratum !== '') byStratum[metric.stratum] = metricResultFromEstimate(metric)
    }
    return {
        metricKey: key,
        displayName: displayMetricName(key),
        overall: metricResultFromEstimate(overall),
        byStratum,
    }
}

export function findTier0Key(metrics: MetricEstimate[]): string | null {
    const key = tierValidityRateKey(0)
    return metrics.some((metric) => metric.metricKey === key && metric.stratum === '') ? key : null
}

export function findSolv0Key(metrics: MetricEstimate[], metricLabel: string): string | null {
    const exact = solvRateKey(0, metricLabel)
    return metrics.some((metric) => metric.metricKey === exact && metric.stratum === '') ? exact : null
}
