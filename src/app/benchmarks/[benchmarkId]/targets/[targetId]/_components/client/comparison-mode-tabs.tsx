'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type ComparisonMode = 'gt-only' | 'gt-vs-pred' | 'pred-vs-pred'

interface ComparisonModeTabsProps {
    currentMode: ComparisonMode
    hasAcceptableRoutes: boolean
    children: {
        gtOnly: React.ReactNode
        gtVsPred: React.ReactNode
        predVsPred: React.ReactNode
    }
}

/**
 * Tab-based UI for switching between comparison modes.
 * Controls which model selectors are visible and how routes are compared.
 */
export function ComparisonModeTabs({ currentMode, hasAcceptableRoutes, children }: ComparisonModeTabsProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleModeChange = (mode: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('mode', mode)

        // Clear model selections when switching modes
        if (mode === 'gt-only') {
            params.delete('model1')
            params.delete('model2')
            params.delete('rank1')
            params.delete('rank2')
            params.delete('view')
            // Keep acceptableIndex - user may want to view different acceptable routes
        } else if (mode === 'gt-vs-pred') {
            params.delete('model2')
            params.delete('rank2')
            // Keep acceptableIndex - comparing specific acceptable route
        } else if (mode === 'pred-vs-pred') {
            // Clear acceptableIndex in pred-vs-pred mode (not used)
            params.delete('acceptableIndex')
        }

        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    return (
        <Tabs value={currentMode} onValueChange={handleModeChange}>
            <TabsList>
                <TabsTrigger value="gt-only" disabled={!hasAcceptableRoutes}>
                    Acceptable Route Only
                </TabsTrigger>
                <TabsTrigger value="gt-vs-pred" disabled={!hasAcceptableRoutes}>
                    Acceptable Route vs Prediction
                </TabsTrigger>
                <TabsTrigger value="pred-vs-pred">Compare Predictions</TabsTrigger>
            </TabsList>

            <TabsContent value="gt-only">{children.gtOnly}</TabsContent>
            <TabsContent value="gt-vs-pred">{children.gtVsPred}</TabsContent>
            <TabsContent value="pred-vs-pred">{children.predVsPred}</TabsContent>
        </Tabs>
    )
}
