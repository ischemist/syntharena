'use client'

// Create a context to pass selectedTopK down to stratified sections
import { createContext, useContext, useState } from 'react'

import type { LeaderboardEntry } from '@/types'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

import { BenchmarkMetricsDisplay } from './benchmark-metrics-display'

type BenchmarkMetricsWrapperProps = {
    topKMetricNames: string[]
    entries: LeaderboardEntry[]
    stratifiedSections: React.ReactNode
}

// Default Top-K values to show
const DEFAULT_TOP_K = ['Top-1', 'Top-5', 'Top-10']

/**
 * Client component that manages Top-K selection state for both overall and stratified metrics.
 * Following App Router Manifesto:
 * - Client component for interactive UI (useState, onClick)
 * - Receives data as props from server parent
 * - Local state only for non-canonical UI state (Top-K selection)
 */
export function BenchmarkMetricsWrapper({
    topKMetricNames,
    entries,
    stratifiedSections,
}: BenchmarkMetricsWrapperProps) {
    const [selectedTopK, setSelectedTopK] = useState<string[]>(
        // Filter default Top-K to only include what's available
        DEFAULT_TOP_K.filter((k) => topKMetricNames.includes(k))
    )

    const hasTopKMetrics = topKMetricNames.length > 0

    // Allow user to select which Top-K metrics to display
    const handleTopKToggle = (metricName: string) => {
        setSelectedTopK((prev) => {
            const newSelection = prev.includes(metricName)
                ? prev.filter((k) => k !== metricName)
                : [...prev, metricName]

            // Sort numerically by extracting the K value
            return newSelection.sort((a, b) => {
                const aNum = parseInt(a.replace(/^\D+/, ''))
                const bNum = parseInt(b.replace(/^\D+/, ''))
                return aNum - bNum
            })
        })
    }

    return (
        <div className="space-y-8">
            {/* Overall metrics section */}
            <div>
                <div className="mb-4 flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold">Overall Metrics</h3>

                    {/* Top-K selector */}
                    {hasTopKMetrics && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Show Top-K:</span>
                            <div className="flex gap-1">
                                {topKMetricNames.map((metricName) => (
                                    <Button
                                        key={metricName}
                                        variant={selectedTopK.includes(metricName) ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => handleTopKToggle(metricName)}
                                    >
                                        {metricName}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <BenchmarkMetricsDisplay
                    entries={entries}
                    topKMetricNames={topKMetricNames}
                    selectedTopK={selectedTopK}
                />
            </div>

            <Separator />

            {/* Pass selectedTopK to stratified sections via context */}
            <TopKContext.Provider value={selectedTopK}>{stratifiedSections}</TopKContext.Provider>
        </div>
    )
}

const TopKContext = createContext<string[]>([])

export function useSelectedTopK() {
    return useContext(TopKContext)
}
