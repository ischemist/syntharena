'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface CompactRankNavigatorProps {
    paramName: 'rank1' | 'rank2' | 'acceptableIndex'
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
    const [jumpValue, setJumpValue] = React.useState(String(displayRank))
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
            setJumpValue(String(displayRank))
            return
        }

        const rankToFind = isZeroBased ? targetValue - 1 : targetValue
        if (availableRanks.includes(rankToFind)) {
            router.replace(buildHref(rankToFind), { scroll: false })
        } else {
            setJumpValue(String(displayRank)) // Reset if invalid
        }
    }

    React.useEffect(() => {
        setJumpValue(String(displayRank))
    }, [displayRank])

    if (rankCount <= 1) return null

    const prevRankIndex = availableRanks.indexOf(currentRank) - 1
    const nextRankIndex = availableRanks.indexOf(currentRank) + 1
    const prevHref = prevRankIndex >= 0 ? buildHref(availableRanks[prevRankIndex]) : null
    const nextHref = nextRankIndex < availableRanks.length ? buildHref(availableRanks[nextRankIndex]) : null

    const renderButton = (href: string | null, direction: 'prev' | 'next') => {
        const Icon = direction === 'prev' ? ChevronLeft : ChevronRight
        const content = (
            <Button variant="ghost" size="icon" className="h-9 w-9" disabled={!href}>
                <Icon className="size-4" />
            </Button>
        )
        if (!href) return content
        return (
            <a
                href={href}
                onClick={(e) => {
                    e.preventDefault()
                    router.replace(href, { scroll: false })
                }}
            >
                {content}
            </a>
        )
    }

    return (
        <TooltipProvider delayDuration={300}>
            <div className="flex items-center gap-1">
                {renderButton(prevHref, 'prev')}
                <form onSubmit={handleJump} className="flex items-center">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Input
                                type="text"
                                value={jumpValue}
                                onChange={(e) => setJumpValue(e.target.value)}
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
                {renderButton(nextHref, 'next')}
            </div>
        </TooltipProvider>
    )
}
