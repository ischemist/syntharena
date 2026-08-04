'use client'

import { useRouter } from 'next/navigation'

import type { RunEvaluationListItem } from '@/lib/services/view/prediction.view'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface EvaluationSelectorProps {
    evaluations: RunEvaluationListItem[]
    currentEvaluationId?: string
}

export function EvaluationSelector({ evaluations, currentEvaluationId }: EvaluationSelectorProps) {
    const router = useRouter()

    const handleEvaluationChange = (value: string) => {
        const params = new URLSearchParams(window.location.search)
        params.set('evaluation', value)
        params.delete('page')
        router.replace(`?${params.toString()}`)
    }

    if (evaluations.length === 0 || !currentEvaluationId) {
        return null
    }

    return (
        <div className="flex items-center gap-4">
            <Label htmlFor="evaluation-select">Evaluation</Label>
            <Select value={currentEvaluationId} onValueChange={handleEvaluationChange}>
                <SelectTrigger id="evaluation-select" className="w-[260px]">
                    <SelectValue placeholder="Select evaluation" />
                </SelectTrigger>
                <SelectContent>
                    {evaluations.map((evaluation) => (
                        <SelectItem key={evaluation.id} value={evaluation.id}>
                            Solv-0[{evaluation.metricLabel}]
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
