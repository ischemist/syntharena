import type { BenchmarkTargetWithMolecule } from '@/types'
import * as predictionView from '@/lib/services/view/prediction.view'

import { TargetSearch } from '../client/target-search'

type TargetSearchWrapperProps = {
    runId: string
    stockId?: string
    currentTargetId?: string
    routeLength?: string
}

export async function TargetSearchWrapper({ runId, stockId, currentTargetId, routeLength }: TargetSearchWrapperProps) {
    // Parse route length filter
    const routeLengthFilter = routeLength ? parseInt(routeLength, 10) : undefined

    // Get target IDs for this run (ordered) - filtered by route length if specified
    const targetIds = await predictionView.getTargetIdsByRun(runId, routeLengthFilter)

    // Get available route lengths (empty if no acceptable routes)
    const availableRouteLengths = await predictionView.getAvailableRouteLengths(runId)

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
            currentIndex >= 0 && currentIndex < targetIds.length - 1
                ? targetIds[currentIndex + 1]
                : currentIndex < 0 && targetIds.length > 0
                  ? targetIds[0] // When no target is selected, next goes to first target
                  : undefined,
    }

    // Create a server action to pass to the client component
    async function handleSearch(query: string, selectedRouteLength?: number): Promise<BenchmarkTargetWithMolecule[]> {
        'use server'
        return predictionView.searchTargets(runId, query, stockId, selectedRouteLength, 20)
    }

    return (
        <TargetSearch
            onSearch={handleSearch}
            navigation={navigationData}
            availableRouteLengths={availableRouteLengths}
            currentRouteLength={routeLengthFilter}
        />
    )
}
