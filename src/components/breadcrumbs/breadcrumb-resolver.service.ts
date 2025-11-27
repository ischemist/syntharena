'use server'

import { getBenchmarkById } from '@/lib/services/benchmark.service'
import { getPredictionRunById } from '@/lib/services/prediction.service'
import { getStockById } from '@/lib/services/stock.service'

import { getEntityType, isDynamicSegment } from './types'

/**
 * Resolves display names for dynamic segments (IDs) in the URL.
 * This is a server action that fetches entity names from the database.
 *
 * @param segments - Array of URL path segments
 * @returns Record mapping segment IDs to their display names
 */
export async function resolveSegmentNames(segments: string[]): Promise<Record<string, string>> {
    const names: Record<string, string> = {}

    // Process each segment to identify and resolve dynamic IDs
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]

        // Skip static segments and route groups
        if (!isDynamicSegment(segment) || segment.startsWith('(')) {
            continue
        }

        // Determine entity type based on context
        const entityType = getEntityType(segments, i)

        if (!entityType) {
            // Unknown dynamic segment, use the ID itself
            names[segment] = segment
            continue
        }

        try {
            // Fetch entity name based on type
            switch (entityType) {
                case 'benchmark': {
                    const benchmark = await getBenchmarkById(segment)
                    if (benchmark) {
                        names[segment] = benchmark.name
                    }
                    break
                }
                case 'run': {
                    const run = await getPredictionRunById(segment)
                    if (run) {
                        // Format: "ModelName on BenchmarkName"
                        const modelName = run.modelInstance.name || run.modelInstance.algorithm.name
                        const benchmarkName = run.benchmarkSet.name
                        names[segment] = `${modelName} on ${benchmarkName}`
                    }
                    break
                }
                case 'stock': {
                    const stock = await getStockById(segment)
                    if (stock) {
                        names[segment] = stock.name
                    }
                    break
                }
                case 'target': {
                    // For targets, we show a shortened ID (first 8 chars)
                    // Full target details are already shown in the page header
                    names[segment] = `Target ${segment.substring(0, 8)}...`
                    break
                }
                default: {
                    // Fallback: use the segment ID itself
                    names[segment] = segment
                }
            }
        } catch (error) {
            // If fetch fails, fall back to showing the ID
            console.error(`Failed to resolve name for ${entityType} ${segment}:`, error)
            names[segment] = segment
        }
    }

    return names
}
