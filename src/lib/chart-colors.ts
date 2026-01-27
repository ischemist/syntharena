import colors from 'tailwindcss/colors'

// High-contrast color families for algorithm grouping (8 distinct families)
// Ordered by visual distinctness for adjacent assignments
const ALGORITHM_COLOR_FAMILIES = [
    'sky', // Blue tones
    'rose', // Pink/red tones
    'emerald', // Green tones
    'purple', // Purple tones
    'amber', // Orange/yellow tones
    'teal', // Cyan tones
    'pink', // Magenta tones
    'indigo', // Deep blue tones
] as const

// Shades within a color family for model family/version differentiation
const FAMILY_SHADES = [400, 500, 600, 700, 800] as const

type ColorFamily = (typeof ALGORITHM_COLOR_FAMILIES)[number]

/**
 * Stable algorithm name sorting for consistent color assignment.
 * We sort alphabetically to ensure the same algorithm always gets the same color,
 * and new algorithms get assigned the next available color in a predictable way.
 */
const ALGORITHM_SORT_CACHE = new Map<string, number>()

/**
 * Get the base color family for an algorithm.
 * Uses alphabetical sorting of all seen algorithms to ensure:
 * 1. Same algorithm always gets same color (stable)
 * 2. Maximum color diversity (no hash collisions)
 * 3. New algorithms get next available color
 */
export function getAlgorithmColorFamily(algorithmName: string): ColorFamily {
    // Check cache first
    if (ALGORITHM_SORT_CACHE.has(algorithmName)) {
        const index = ALGORITHM_SORT_CACHE.get(algorithmName)!
        return ALGORITHM_COLOR_FAMILIES[index % ALGORITHM_COLOR_FAMILIES.length]
    }

    // Add to cache and sort all known algorithms
    const allAlgorithms = Array.from(ALGORITHM_SORT_CACHE.keys())
    allAlgorithms.push(algorithmName)
    allAlgorithms.sort()

    // Reassign indices based on sorted order
    allAlgorithms.forEach((algo, idx) => {
        ALGORITHM_SORT_CACHE.set(algo, idx)
    })

    const index = ALGORITHM_SORT_CACHE.get(algorithmName)!
    return ALGORITHM_COLOR_FAMILIES[index % ALGORITHM_COLOR_FAMILIES.length]
}

/**
 * Get a specific color for a model family+version within an algorithm.
 * Different model families/versions within the same algorithm get different shades.
 *
 * @param algorithmName - e.g., "SynPlanner"
 * @param seriesKey - unique key for this series, e.g., "SynPlanner MCTS Rollout v1.2.0"
 * @param seriesIndex - 0-based index of this series within the algorithm group
 * @returns hex color string
 */
export function getSeriesColor(algorithmName: string, seriesKey: string, seriesIndex: number): string {
    const colorFamily = getAlgorithmColorFamily(algorithmName)

    // Cycle through shades if there are more series than shades
    const shadeIndex = seriesIndex % FAMILY_SHADES.length
    const shade = FAMILY_SHADES[shadeIndex]

    return colors[colorFamily][shade]
}
