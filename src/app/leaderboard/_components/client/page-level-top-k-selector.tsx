'use client'

import { createContext, useContext, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'

type PageLevelTopKSelectorProps = {
    topKMetricNames: string[]
    children: React.ReactNode
}

// Default Top-K values to show
const DEFAULT_TOP_K = ['Top-1', 'Top-5', 'Top-10']

/**
 * Page-level client component that manages Top-K selection via URL state.
 * Provides selected metrics via context to all child components.
 * Renders selector buttons outside of any card for global control.
 * Following App Router Manifesto: URL is canon - state is shareable and refresh-safe.
 */
export function PageLevelTopKSelector({ topKMetricNames, children }: PageLevelTopKSelectorProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // Parse selected Top-K from URL (comma-separated: ?topK=Top-1,Top-5,Top-10)
    // Memoized to maintain stable reference - prevents downstream column recreation
    // which would break TanStack Table's sorting state tracking
    const topKParam = searchParams.get('topK')
    const selectedTopK = useMemo(() => {
        return topKParam
            ? topKParam.split(',').filter((k) => topKMetricNames.includes(k))
            : // Default: filter to only include what's available
              DEFAULT_TOP_K.filter((k) => topKMetricNames.includes(k))
    }, [topKParam, topKMetricNames])

    const handleTopKToggle = (metricName: string) => {
        const newSelection = selectedTopK.includes(metricName)
            ? selectedTopK.filter((k) => k !== metricName)
            : [...selectedTopK, metricName]

        // Sort numerically by extracting the K value
        const sorted = newSelection.sort((a, b) => {
            const aNum = parseInt(a.replace(/^\D+/, ''))
            const bNum = parseInt(b.replace(/^\D+/, ''))
            return aNum - bNum
        })

        // Update URL with new selection
        const params = new URLSearchParams(searchParams.toString())
        if (sorted.length > 0) {
            params.set('topK', sorted.join(','))
        } else {
            params.delete('topK')
        }

        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
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
