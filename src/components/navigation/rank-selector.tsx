'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface RankSelectorProps {
    availableRanks: number[]
    currentRank: number
    paramName: 'rank' | 'rank1' | 'rank2' | 'acceptableIndex'
    zeroBasedIndex?: boolean
}

export function RankSelector({ availableRanks, currentRank, paramName, zeroBasedIndex = false }: RankSelectorProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleValueChange = (newRank: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set(paramName, newRank)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    if (availableRanks.length <= 1) {
        return null
    }

    return (
        <Select
            value={String(currentRank)}
            onValueChange={handleValueChange}
            // disable if only one option, prevents unnecessary interactions
            disabled={availableRanks.length <= 1}
        >
            <SelectTrigger className="w-40">
                <SelectValue placeholder="Jump to rank..." />
            </SelectTrigger>
            <SelectContent>
                {availableRanks.map((rank) => (
                    <SelectItem key={rank} value={String(rank)}>
                        {zeroBasedIndex ? `Acceptable Route ${rank + 1}` : `Rank ${rank}`}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
