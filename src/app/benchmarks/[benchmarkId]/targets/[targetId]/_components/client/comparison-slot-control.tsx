'use client'

import { usePathname, useSearchParams } from 'next/navigation'

import type { PredictionRunSummary } from '@/types'
import { ModelSelector, RankSelector, StepButton } from '@/components/navigation'

interface ComparisonSlotControlProps {
    runs: PredictionRunSummary[]
    selectedRunId?: string
    paramName: 'model1' | 'model2'
    rankParamName: 'rank1' | 'rank2'
    label: string
    navigation?: {
        rank: number
        availableRanks: number[]
        previousRankHref: string | null
        nextRankHref: string | null
    }
}

/**
 * a self-contained control panel for one "slot" in the comparison view.
 * it orchestrates model selection and rank navigation, ensuring url state is always valid.
 */
export function ComparisonSlotControl({
    runs,
    selectedRunId,
    paramName,
    rankParamName,
    label,
    navigation,
}: ComparisonSlotControlProps) {
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // this is the critical logic. when a new model is selected,
    // we find its first available rank and build a url that defaults to it.
    // this prevents the context reset bug permanently.
    const buildModelHref = (newRunId: string): string => {
        const params = new URLSearchParams(searchParams.toString())
        const selectedRun = runs.find((r) => r.id === newRunId)
        const firstRank = selectedRun?.availableRanks[0] ?? 1

        params.set(paramName, newRunId)
        params.set(rankParamName, String(firstRank))

        return `${pathname}?${params.toString()}`
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{label}:</span>
                <ModelSelector runs={runs} selectedRunId={selectedRunId} buildHref={buildModelHref} />
            </div>

            {navigation && (
                <div className="flex items-center gap-2">
                    <StepButton href={navigation.previousRankHref} direction="prev">
                        Prev
                    </StepButton>
                    <div className="text-muted-foreground flex-1 text-center text-sm">
                        Rank {navigation.rank} of {navigation.availableRanks.length}
                    </div>
                    <StepButton href={navigation.nextRankHref} direction="next">
                        Next
                    </StepButton>
                    <RankSelector
                        availableRanks={navigation.availableRanks}
                        currentRank={navigation.rank}
                        paramName={rankParamName}
                    />
                </div>
            )}
        </div>
    )
}
