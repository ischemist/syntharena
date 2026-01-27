import colors from 'tailwindcss/colors'

// a curated, high-contrast palette for chart series
const PALETTE = [
    colors.sky[500],
    colors.rose[500],
    colors.amber[500],
    colors.teal[500],
    colors.indigo[500],
    colors.lime[500],
    colors.fuchsia[500],
    colors.orange[500],
    colors.emerald[500],
    colors.pink[500],
    colors.blue[500],
    colors.violet[500],
]

/**
 * generates a consistent color from a string input (e.g., a model family name).
 * uses a simple, non-cryptographic hashing function to map the string to an index
 * in the predefined color palette.
 * @param str the string to hash.
 * @returns a hex color string.
 */
export function getProceduralColor(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash |= 0 // convert to 32bit integer
    }

    const index = Math.abs(hash) % PALETTE.length
    return PALETTE[index]
}
