import type { BenchmarkTargetWithMolecule } from '@/types'
import { searchTargets } from '@/lib/services/prediction.service'

import { TargetSearch } from '../client/target-search'

type TargetSearchWrapperProps = {
    runId: string
    stockId?: string
}

export function TargetSearchWrapper({ runId, stockId }: TargetSearchWrapperProps) {
    // Create a server action to pass to the client component
    async function handleSearch(query: string): Promise<BenchmarkTargetWithMolecule[]> {
        'use server'
        return searchTargets(runId, query, stockId, 20)
    }

    return <TargetSearch onSearch={handleSearch} />
}
