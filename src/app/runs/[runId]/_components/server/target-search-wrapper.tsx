import type { BenchmarkTargetWithMolecule } from '@/types'
import { getTargetIdsByRun, searchTargets } from '@/lib/services/prediction.service'

import { TargetSearch } from '../client/target-search'

type TargetSearchWrapperProps = {
    runId: string
    stockId?: string
    currentTargetId?: string
}

export async function TargetSearchWrapper({ runId, stockId, currentTargetId }: TargetSearchWrapperProps) {
    // Get all target IDs for this run (ordered)
    const targetIds = await getTargetIdsByRun(runId, stockId)

    // Find current position
    let currentIndex = -1
    if (currentTargetId) {
        currentIndex = targetIds.indexOf(currentTargetId)
    }

    // Calculate navigation data
    const navigationData = {
        totalTargets: targetIds.length,
        currentIndex: currentIndex >= 0 ? currentIndex : undefined,
        previousTargetId: currentIndex > 0 ? targetIds[currentIndex - 1] : undefined,
        nextTargetId:
            currentIndex >= 0 && currentIndex < targetIds.length - 1 ? targetIds[currentIndex + 1] : undefined,
    }

    // Create a server action to pass to the client component
    async function handleSearch(query: string): Promise<BenchmarkTargetWithMolecule[]> {
        'use server'
        return searchTargets(runId, query, stockId, 20)
    }

    return <TargetSearch onSearch={handleSearch} navigation={navigationData} />
}
