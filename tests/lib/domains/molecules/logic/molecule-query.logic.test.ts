import { describe, expect, it } from 'vitest'

import {
    normalizeInchiKeyCandidate,
    parseMoleculeLookupQuery,
} from '@/lib/domains/molecules/logic/molecule-query.logic'

describe('normalizeInchiKeyCandidate', () => {
    it('keeps a canonical hyphenated inchikey intact', () => {
        expect(normalizeInchiKeyCandidate('BSYNRYMUTXBXSQ-UHFFFAOYSA-N')).toBe('BSYNRYMUTXBXSQ-UHFFFAOYSA-N')
    })

    it('normalizes lowercase inchikey input', () => {
        expect(normalizeInchiKeyCandidate('bsynrymutxbxsq-uhfffaoysa-n')).toBe('BSYNRYMUTXBXSQ-UHFFFAOYSA-N')
    })

    it('restores missing hyphens for compact inchikey input', () => {
        expect(normalizeInchiKeyCandidate('BSYNRYMUTXBXSQUHFFFAOYSAN')).toBe('BSYNRYMUTXBXSQ-UHFFFAOYSA-N')
    })

    it('rejects non-inchikey strings', () => {
        expect(normalizeInchiKeyCandidate('CCO')).toBeNull()
    })
})

describe('parseMoleculeLookupQuery', () => {
    it('classifies empty input explicitly', () => {
        expect(parseMoleculeLookupQuery('   ')).toEqual({ kind: 'empty' })
    })

    it('classifies inchikey input after normalization', () => {
        expect(parseMoleculeLookupQuery('bsynrymutxbxsq-uhfffaoysa-n')).toEqual({
            kind: 'inchikey',
            inchikey: 'BSYNRYMUTXBXSQ-UHFFFAOYSA-N',
        })
    })

    it('treats everything else as smiles input', () => {
        expect(parseMoleculeLookupQuery('CC(=O)Oc1ccccc1C(=O)O')).toEqual({
            kind: 'smiles',
            smiles: 'CC(=O)Oc1ccccc1C(=O)O',
        })
    })
})
