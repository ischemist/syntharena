'use client'

import { useSelectedTopK } from './page-level-top-k-selector'

type StratifiedMetricsFilterProps = {
    metricName: string
    children: React.ReactNode
}

/**
 * Client component that conditionally renders stratified metric cards based on Top-K selection.
 * Tier-0 and Solv-0 are always shown; Top-K metrics are optional.
 */
export function StratifiedMetricsFilter({ metricName, children }: StratifiedMetricsFilterProps) {
    const selectedTopK = useSelectedTopK()

    if (metricName === 'Tier-0 valid' || metricName.startsWith('Solv-0[')) {
        return <>{children}</>
    }

    // Only show Top-K metrics if they're selected
    if (selectedTopK.includes(metricName)) {
        return <>{children}</>
    }

    return null
}
