'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { StepButton } from './step-button'

interface RankNavigatorProps {
    paramName: 'rank' | 'rank1' | 'rank2' | 'acceptableIndex'
    prevHref: string | null
    nextHref: string | null
    currentRank: number
    rankCount: number
    availableRanks: number[]
    label: string
    isZeroBased?: boolean
}

/** a scalable, compact navigator for ranked items. replaces dropdowns with a jump-to input. */
export function RankNavigator({
    paramName,
    prevHref,
    nextHref,
    currentRank,
    rankCount,
    availableRanks,
    label,
    isZeroBased = false,
}: RankNavigatorProps) {
    const [jumpValue, setJumpValue] = React.useState(String(isZeroBased ? currentRank + 1 : currentRank))
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

    const handleJump = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const targetValue = parseInt(jumpValue, 10)
        if (isNaN(targetValue)) {
            setJumpValue(String(isZeroBased ? currentRank + 1 : currentRank))
            return
        }

        const rankToFind = isZeroBased ? targetValue - 1 : targetValue
        if (availableRanks.includes(rankToFind)) {
            router.replace(buildHref(rankToFind), { scroll: false })
        } else {
            setJumpValue(String(isZeroBased ? currentRank + 1 : currentRank))
        }
    }

    React.useEffect(() => {
        setJumpValue(String(isZeroBased ? currentRank + 1 : currentRank))
    }, [currentRank, isZeroBased])

    if (rankCount <= 1) return null

    return (
        <div className="flex items-center gap-2">
            <StepButton href={prevHref} direction="prev">
                Prev
            </StepButton>
            <form onSubmit={handleJump} className="flex items-center gap-1">
                <span className="text-muted-foreground text-sm text-nowrap">{label}</span>
                <Input
                    type="text"
                    value={jumpValue}
                    onChange={(e) => setJumpValue(e.target.value)}
                    onBlur={() => setJumpValue(String(isZeroBased ? currentRank + 1 : currentRank))}
                    className="h-9 w-14 text-center"
                    aria-label={`Jump to ${label}`}
                />
                <span className="text-muted-foreground text-sm text-nowrap">of {rankCount}</span>
                <Button type="submit" variant="ghost" size="icon" className="h-9 w-9" aria-label={`Go to ${label}`}>
                    <ArrowRight className="size-4" />
                </Button>
            </form>
            <StepButton href={nextHref} direction="next">
                Next
            </StepButton>
        </div>
    )
}
