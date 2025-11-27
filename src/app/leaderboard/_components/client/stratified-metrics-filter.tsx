'use client'

import { useSelectedTopK } from './page-level-top-k-selector'

type StratifiedMetricsFilterProps = {
    metricName: string
    children: React.ReactNode
}

/**
 * Client component that conditionally renders stratified metric cards based on Top-K selection.
 * Solvability is always shown, Top-K metrics only shown if selected.
 */
export function StratifiedMetricsFilter({ metricName, children }: StratifiedMetricsFilterProps) {
    const selectedTopK = useSelectedTopK()

    // Always show Solvability
    if (metricName === 'Solvability') {
        return <>{children}</>
    }

    // Only show Top-K metrics if they're selected
    if (selectedTopK.includes(metricName)) {
        return <>{children}</>
    }

    return null
}
