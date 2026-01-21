'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { StepButton } from './step-button' // we'll still use this inside

interface RankNavigatorProps {
    // a function to build the href for a given rank, e.g. `(rank) => buildHref({ rank1: rank })`
    buildHref: (rank: number) => string
    // url for the previous and next valid ranks
    prevHref: string | null
    nextHref: string | null
    // current rank and the total number of valid ranks
    currentRank: number
    rankCount: number
    // the actual list of available ranks to validate against
    availableRanks: number[]
    // label for the rank, e.g. 'Rank' or 'Route'
    label: string
}

export function RankNavigator({
    buildHref,
    prevHref,
    nextHref,
    currentRank,
    rankCount,
    availableRanks,
    label,
}: RankNavigatorProps) {
    const [jumpValue, setJumpValue] = React.useState(String(currentRank))
    const router = useRouter()

    const handleJump = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const rank = parseInt(jumpValue, 10)
        if (!isNaN(rank) && availableRanks.includes(rank)) {
            router.replace(buildHref(rank), { scroll: false })
        } else {
            // reset to current if invalid
            setJumpValue(String(currentRank))
        }
    }

    React.useEffect(() => {
        setJumpValue(String(currentRank))
    }, [currentRank])

    // if there's only one or zero options, render nothing. it's not a navigator.
    if (rankCount <= 1) return null

    return (
        <div className="flex items-center gap-2">
            <StepButton href={prevHref} direction="prev">
                Prev
            </StepButton>
            <form onSubmit={handleJump} className="flex items-center gap-1">
                <span className="text-muted-foreground text-sm whitespace-nowrap">{label}</span>
                <Input
                    type="text"
                    value={jumpValue}
                    onChange={(e) => setJumpValue(e.target.value)}
                    onBlur={() => setJumpValue(String(currentRank))} // reset on blur if not submitted
                    className="h-9 w-12 text-center"
                />
                <span className="text-muted-foreground text-sm whitespace-nowrap">of {rankCount}</span>
                <Button type="submit" variant="ghost" size="icon" className="h-9 w-9">
                    <ArrowRight className="size-4" />
                </Button>
            </form>
            <StepButton href={nextHref} direction="next">
                Next
            </StepButton>
        </div>
    )
}
