'use client'

import type { StratifiedMetric } from '@/types'

import { useSelectedTopK } from './page-level-top-k-selector'
import { StratifiedMetricTable } from './stratified-metric-table'

type StratifiedMetricsSectionProps = {
    metricsMap: Map<
        string,
        {
            solvability: StratifiedMetric
            topKAccuracy?: Record<string, StratifiedMetric>
        }
    >
}

/**
 * Client component for displaying stratified metrics (broken down by route length).
 * Shows all stratified metrics in tables within the same card section.
 * Uses TanStack Table for sorting functionality.
 */
export function StratifiedMetricsSection({ metricsMap }: StratifiedMetricsSectionProps) {
    // Get selected Top-K from context
    const selectedTopK = useSelectedTopK()
    if (metricsMap.size === 0) {
        return null
    }

    // Convert map to array for rendering
    const modelsArray = Array.from(metricsMap.entries())

    // Get all route lengths present in the data
    const routeLengths = new Set<number>()
    modelsArray.forEach(([, metrics]) => {
        Object.keys(metrics.solvability.byGroup).forEach((length) => {
            routeLengths.add(parseInt(length))
        })
        if (metrics.topKAccuracy) {
            Object.values(metrics.topKAccuracy).forEach((topKMetric) => {
                Object.keys(topKMetric.byGroup).forEach((length) => {
                    routeLengths.add(parseInt(length))
                })
            })
        }
    })

    const sortedLengths = Array.from(routeLengths).sort((a, b) => a - b)

    if (sortedLengths.length === 0) {
        return null
    }

    // Filter Top-K metrics to only show selected ones
    const displayedTopK = selectedTopK.filter((metricName) => {
        // Verify at least one model has this metric
        return modelsArray.some(([, metrics]) => metrics.topKAccuracy?.[metricName])
    })

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold">Stratified Metrics</h3>

            {/* Solvability by Route Length */}
            <StratifiedMetricTable metricName="Solvability" metricsMap={metricsMap} routeLengths={sortedLengths} />

            {/* Top-K Accuracy by Route Length */}
            {displayedTopK.map((topKMetricName) => (
                <StratifiedMetricTable
                    key={topKMetricName}
                    metricName={topKMetricName}
                    metricsMap={metricsMap}
                    routeLengths={sortedLengths}
                />
            ))}
        </div>
    )
}
