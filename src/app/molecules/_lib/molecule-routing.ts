import { normalizeInchiKeyCandidate } from '@/lib/domains/molecules/logic/molecule-query.logic'

export function getFirstSearchParamValue(value: string | string[] | undefined): string {
    if (typeof value === 'string') {
        return value
    }

    if (Array.isArray(value)) {
        return value[0] ?? ''
    }

    return ''
}

export function normalizeMoleculeRouteInchiKey(rawInchikey: string): string | null {
    return normalizeInchiKeyCandidate(rawInchikey)
}
