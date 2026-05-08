'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface CompactRankNavigatorProps {
    paramName: 'rank' | 'rank1' | 'rank2' | 'acceptableIndex'
    currentRank: number
    rankCount: number
    availableRanks: number[]
    isZeroBased?: boolean
}

export function CompactRankNavigator({
    paramName,
    currentRank,
    rankCount,
    availableRanks,
    isZeroBased = false,
}: CompactRankNavigatorProps) {
    const displayRank = isZeroBased ? currentRank + 1 : currentRank
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const buildHref = React.useCallback(
        (rankValue: number) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set(paramName, String(rankValue))
            return `${pathname}?${params.toString()}`
        },
        [pathname, searchParams, paramName]
    )

    if (rankCount <= 1) return null

    const prevRankIndex = availableRanks.indexOf(currentRank) - 1
    const nextRankIndex = availableRanks.indexOf(currentRank) + 1
    const prevRankValue = prevRankIndex >= 0 ? availableRanks[prevRankIndex] : null
    const nextRankValue = nextRankIndex < availableRanks.length ? availableRanks[nextRankIndex] : null

    return (
        <TooltipProvider delayDuration={300}>
            <div className="flex items-center gap-1">
                <CompactRankStepButton
                    rankValue={prevRankValue}
                    direction="prev"
                    onNavigate={(rankValue) => router.replace(buildHref(rankValue), { scroll: false })}
                />
                <CompactRankJumpForm
                    key={displayRank}
                    displayRank={displayRank}
                    rankCount={rankCount}
                    isZeroBased={isZeroBased}
                    availableRanks={availableRanks}
                    onJump={(rankValue) => router.replace(buildHref(rankValue), { scroll: false })}
                />
                <CompactRankStepButton
                    rankValue={nextRankValue}
                    direction="next"
                    onNavigate={(rankValue) => router.replace(buildHref(rankValue), { scroll: false })}
                />
            </div>
        </TooltipProvider>
    )
}

interface CompactRankStepButtonProps {
    rankValue: number | null
    direction: 'prev' | 'next'
    onNavigate: (rankValue: number) => void
}

function CompactRankStepButton({ rankValue, direction, onNavigate }: CompactRankStepButtonProps) {
    const Icon = direction === 'prev' ? ChevronLeft : ChevronRight

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9"
            disabled={rankValue === null}
            onClick={() => {
                if (rankValue === null) {
                    return
                }

                onNavigate(rankValue)
            }}
        >
            <Icon className="size-4" />
        </Button>
    )
}

interface CompactRankJumpFormProps {
    displayRank: number
    rankCount: number
    isZeroBased: boolean
    availableRanks: number[]
    onJump: (rankValue: number) => void
}

function CompactRankJumpForm({
    displayRank,
    rankCount,
    isZeroBased,
    availableRanks,
    onJump,
}: CompactRankJumpFormProps) {
    const [jumpValue, setJumpValue] = React.useState(String(displayRank))

    const handleJump = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const targetValue = parseInt(jumpValue, 10)
        if (isNaN(targetValue)) {
            setJumpValue(String(displayRank))
            return
        }

        const rankToFind = isZeroBased ? targetValue - 1 : targetValue
        if (!availableRanks.includes(rankToFind)) {
            setJumpValue(String(displayRank))
            return
        }

        onJump(rankToFind)
    }

    return (
        <form onSubmit={handleJump} className="flex items-center">
            <Tooltip>
                <TooltipTrigger asChild>
                    <Input
                        type="text"
                        value={jumpValue}
                        onChange={(event) => setJumpValue(event.target.value)}
                        onBlur={() => setJumpValue(String(displayRank))}
                        className="h-9 w-12 rounded-r-none border-r-0 text-center"
                        aria-label="Current Rank"
                    />
                </TooltipTrigger>
                <TooltipContent>Jump to rank</TooltipContent>
            </Tooltip>
            <div className="border-input flex h-9 items-center rounded-r-md border bg-transparent px-3 text-sm text-[var(--foreground-secondary)]">
                / {rankCount}
            </div>
        </form>
    )
}
