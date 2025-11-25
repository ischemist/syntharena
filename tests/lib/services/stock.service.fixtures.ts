/**
 * Test fixtures for stock.service tests.
 * Contains realistic test data for molecules, stocks, and CSV file content.
 */

/**
 * Sample molecule data - real SMILES and InChiKey pairs
 */
export const sampleMolecules = [
    {
        smiles: 'C',
        inchikey: 'VNWKTOKETHGBQD-UHFFFAOYSA-N',
        name: 'Methane',
    },
    {
        smiles: 'CC',
        inchikey: 'OTMSDBZJAUFBTE-UHFFFAOYSA-N',
        name: 'Ethane',
    },
    {
        smiles: 'CCC',
        inchikey: 'LXKTOXZUCNLJGD-UHFFFAOYSA-N',
        name: 'Propane',
    },
    {
        smiles: 'CC(C)C',
        inchikey: 'LFQSCWFLJHTTHZ-UHFFFAOYSA-N',
        name: 'Isobutane',
    },
    {
        smiles: 'CC(C)CC',
        inchikey: 'RGHNJXZPGCOGJP-UHFFFAOYSA-N',
        name: 'Isopentane',
    },
    {
        smiles: 'O',
        inchikey: 'XLYOFNOQVQJJNP-UHFFFAOYSA-N',
        name: 'Water',
    },
    {
        smiles: 'CO',
        inchikey: 'OKKJLVBELUTLKV-UHFFFAOYSA-N',
        name: 'Methanol',
    },
]

/**
 * CSV file content - valid format with header
 */
export const validCsvContent = `SMILES,InChi Key
C,VNWKTOKETHGBQD-UHFFFAOYSA-N
CC,OTMSDBZJAUFBTE-UHFFFAOYSA-N
CCC,LXKTOXZUCNLJGD-UHFFFAOYSA-N
CC(C)C,LFQSCWFLJHTTHZ-UHFFFAOYSA-N
CC(C)CC,RGHNJXZPGCOGJP-UHFFFAOYSA-N
O,XLYOFNOQVQJJNP-UHFFFAOYSA-N
CO,OKKJLVBELUTLKV-UHFFFAOYSA-N`

/**
 * CSV content with some invalid lines to test robustness
 */
export const csvWithInvalidLines = `SMILES,InChi Key
C,VNWKTOKETHGBQD-UHFFFAOYSA-N
CC,OTMSDBZJAUFBTE-UHFFFAOYSA-N
CCC
,LXKTOXZUCNLJGD-UHFFFAOYSA-N
CC(C)C,LFQSCWFLJHTTHZ-UHFFFAOYSA-N
O,XLYOFNOQVQJJNP-UHFFFAOYSA-N`

/**
 * CSV with minimal valid data (just header and one row)
 */
export const minimalCsvContent = `SMILES,InChi Key
C,VNWKTOKETHGBQD-UHFFFAOYSA-N`

/**
 * CSV with invalid header
 */
export const invalidHeaderCsv = `SMILES,Canonical
C,VNWKTOKETHGBQD-UHFFFAOYSA-N
CC,OTMSDBZJAUFBTE-UHFFFAOYSA-N`

/**
 * CSV with only header, no data rows
 */
export const headerOnlyCsv = `SMILES,InChi Key`

/**
 * CSV with case variations in header (should be accepted)
 */
export const mixedCaseCsv = `smiles,inchi key
C,VNWKTOKETHGBQD-UHFFFAOYSA-N
CC,OTMSDBZJAUFBTE-UHFFFAOYSA-N`

/**
 * CSV with large dataset (test batch processing)
 */
export const generateLargeCsv = (rows: number): string => {
    let content = 'SMILES,InChi Key\n'
    for (let i = 0; i < rows; i++) {
        const smiles = 'C'.repeat((i % 5) + 1)
        const inchikey = `INCHI-${String(i).padStart(10, '0')}-UHFFFAOYSA-N`
        content += `${smiles},${inchikey}\n`
    }
    return content
}

/**
 * Helper to create mock stock data
 */
export const createMockStock = (name: string, description?: string) => ({
    name,
    description: description || null,
})

/**
 * Common test stock configurations
 */
export const testStocks = {
    druglike: {
        name: 'drug-like-compounds',
        description: 'Drug-like molecules from screening library',
    },
    commercial: {
        name: 'commercial-reagents',
        description: 'Commercially available reagents',
    },
    organic: {
        name: 'organic-synthesis',
    },
}
