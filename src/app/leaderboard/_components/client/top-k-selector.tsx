'use client'

import { createContext, useContext, useState } from 'react'

import { Button } from '@/components/ui/button'

type TopKSelectorWrapperProps = {
    topKMetricNames: string[]
    children: React.ReactNode
}

// Default Top-K values to show
const DEFAULT_TOP_K = ['Top-1', 'Top-5', 'Top-10']

/**
 * Client component wrapper that manages Top-K selection state.
 * Provides selected metrics via context to child components.
 * Renders the selector buttons and wraps children with context.
 */
export function TopKSelectorWrapper({ topKMetricNames, children }: TopKSelectorWrapperProps) {
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
            <div className="mb-4 flex items-center gap-2">
                <span className="text-muted-foreground text-sm font-medium">Show Top-K:</span>
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
            {children}
        </TopKContext.Provider>
    )
}

const TopKContext = createContext<string[]>([])

export function useSelectedTopK() {
    return useContext(TopKContext)
}
