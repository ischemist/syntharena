'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type PredictionNavigatorProps = {
    currentRank: number
    totalPredictions: number
    targetId: string
}

export function PredictionNavigator({ currentRank, totalPredictions, targetId }: PredictionNavigatorProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const isFirstPrediction = currentRank === 1
    const isLastPrediction = currentRank === totalPredictions

    const navigateToRank = (newRank: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('target', targetId)
        params.set('rank', newRank.toString())
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const handlePrevious = () => {
        if (!isFirstPrediction) {
            navigateToRank(currentRank - 1)
        }
    }

    const handleNext = () => {
        if (!isLastPrediction) {
            navigateToRank(currentRank + 1)
        }
    }

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowLeft' && !isFirstPrediction) {
            handlePrevious()
        } else if (e.key === 'ArrowRight' && !isLastPrediction) {
            handleNext()
        }
    }

    return (
        <Card onKeyDown={handleKeyDown} tabIndex={0}>
            <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrevious}
                        disabled={isFirstPrediction}
                        aria-label="Previous prediction"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>

                    <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-medium">
                            Prediction {currentRank} of {totalPredictions}
                        </span>
                        <span className="text-muted-foreground text-xs">Use arrow keys to navigate</span>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNext}
                        disabled={isLastPrediction}
                        aria-label="Next prediction"
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
