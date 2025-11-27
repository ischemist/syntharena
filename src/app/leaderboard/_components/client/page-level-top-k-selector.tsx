'use client'

import { createContext, useContext, useState } from 'react'

import { Button } from '@/components/ui/button'

type PageLevelTopKSelectorProps = {
    topKMetricNames: string[]
    children: React.ReactNode
}

// Default Top-K values to show
const DEFAULT_TOP_K = ['Top-1', 'Top-5', 'Top-10']

/**
 * Page-level client component that manages Top-K selection state for all metrics.
 * Provides selected metrics via context to all child components.
 * Renders selector buttons outside of any card for global control.
 */
export function PageLevelTopKSelector({ topKMetricNames, children }: PageLevelTopKSelectorProps) {
    const [selectedTopK, setSelectedTopK] = useState<string[]>(
        // Filter default Top-K to only include what's available
        DEFAULT_TOP_K.filter((k) => topKMetricNames.includes(k))
    )

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
        <TopKContext.Provider value={selectedTopK}>
            {/* Top-K Selector - Page Level */}
            <div className="border-border/60 bg-card flex items-center gap-3 rounded-lg border p-4">
                <span className="text-sm font-medium">Show Top-K Metrics:</span>
                <div className="flex gap-2">
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

            {/* Render children with context */}
            {children}
        </TopKContext.Provider>
    )
}

const TopKContext = createContext<string[]>([])

export function useSelectedTopK() {
    return useContext(TopKContext)
}
