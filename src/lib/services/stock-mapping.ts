/**
 * Stock name mapping and matching logic.
 * Handles flexible matching between benchmark stockName definitions
 * and actual stock names in the database.
 *
 * Benchmark files often use normalized names like "n1-n5-stock"
 * but actual stocks might be named "n1 + n5 Stock" or "n1 Stock".
 * This module provides intelligent matching.
 */

import type { StockListItem } from '@/types'

/**
 * Mapping of benchmark stock names to actual stock names in database.
 * Used when exact matching fails.
 */
const STOCK_NAME_MAPPINGS: Record<string, string[]> = {
    'n1-n5-stock': ['n1 + n5 Stock', 'n1+n5 Stock', 'n1 Stock + n5 Stock', 'n1-n5 Stock'],
    'n1-stock': ['n1 Stock', 'n1-stock'],
    'n5-stock': ['n5 Stock', 'n5-stock'],
    'askcos-stock': ['ASKCOS Buyables Stock', 'ASKCOS Stock'],
}

/**
 * Finds a matching stock from available stocks.
 * Uses fuzzy matching to handle naming variations.
 *
 * Strategy:
 * 1. Try exact match (case-insensitive)
 * 2. Try predefined mappings
 * 3. Try substring matching (normalized)
 * 4. Return undefined if no match
 *
 * @param benchmarkStockName - The stock name from benchmark definition
 * @param availableStocks - List of stocks available in database
 * @returns Matching stock or undefined
 */
export function findMatchingStock(
    benchmarkStockName: string | null | undefined,
    availableStocks: StockListItem[]
): StockListItem | undefined {
    if (!benchmarkStockName) return undefined

    const normalizedBenchmarkName = benchmarkStockName.toLowerCase().trim()

    // Strategy 1: Exact match (case-insensitive)
    const exactMatch = availableStocks.find((stock) => stock.name.toLowerCase() === normalizedBenchmarkName)
    if (exactMatch) return exactMatch

    // Strategy 2: Check predefined mappings
    const mappedNames = STOCK_NAME_MAPPINGS[normalizedBenchmarkName]
    if (mappedNames) {
        for (const mappedName of mappedNames) {
            const stock = availableStocks.find((s) => s.name.toLowerCase() === mappedName.toLowerCase())
            if (stock) return stock
        }
    }

    // Strategy 3: Normalize both and try substring matching
    // Remove common separators and try to match based on content
    const normalizeForMatching = (name: string): string[] => {
        return name
            .toLowerCase()
            .split(/[-_+\s]+/)
            .filter((part) => part.length > 0)
            .sort()
    }

    const benchmarkParts = normalizeForMatching(benchmarkStockName)
    if (benchmarkParts.length > 0) {
        // Try to find a stock where all benchmark parts are in the stock name
        const fuzzyMatch = availableStocks.find((stock) => {
            const stockParts = normalizeForMatching(stock.name)
            return benchmarkParts.every((part) => stockParts.includes(part))
        })
        if (fuzzyMatch) return fuzzyMatch
    }

    return undefined
}

/**
 * Gets all possible stock names that could match a benchmark name.
 * Useful for debugging or showing users what stocks are available.
 */
export function getPossibleStockMatches(benchmarkStockName: string): string[] {
    const normalized = benchmarkStockName.toLowerCase().trim()
    return STOCK_NAME_MAPPINGS[normalized] || []
}
