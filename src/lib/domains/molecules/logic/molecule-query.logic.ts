const HYPHENATED_INCHIKEY_PATTERN = /^[A-Z]{14}-[A-Z]{10}-[A-Z]$/
const COMPACT_INCHIKEY_PATTERN = /^[A-Z]{25}$/

export type MoleculeLookupQuery =
    | { kind: 'empty' }
    | { kind: 'inchikey'; inchikey: string }
    | { kind: 'smiles'; smiles: string }

export function normalizeInchiKeyCandidate(value: string): string | null {
    const trimmedValue = value.trim()
    if (!trimmedValue) return null

    const uppercaseValue = trimmedValue.toUpperCase()
    if (HYPHENATED_INCHIKEY_PATTERN.test(uppercaseValue)) {
        return uppercaseValue
    }

    const compactValue = uppercaseValue.replaceAll('-', '')
    if (!COMPACT_INCHIKEY_PATTERN.test(compactValue)) {
        return null
    }

    return `${compactValue.slice(0, 14)}-${compactValue.slice(14, 24)}-${compactValue.slice(24)}`
}

export function parseMoleculeLookupQuery(rawQuery: string): MoleculeLookupQuery {
    const trimmedQuery = rawQuery.trim()
    if (!trimmedQuery) {
        return { kind: 'empty' }
    }

    const normalizedInchikey = normalizeInchiKeyCandidate(trimmedQuery)
    if (normalizedInchikey) {
        return { kind: 'inchikey', inchikey: normalizedInchikey }
    }

    return { kind: 'smiles', smiles: trimmedQuery }
}
