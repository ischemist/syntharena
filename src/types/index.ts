// ============================================================================
// Server Action Response Type
// ============================================================================

/**
 * A standard wrapper for server action responses, providing a consistent
 * structure for handling success and failure states on the client.
 */
export type ActionState<T> =
    | {
          isSuccess: true
          message: string
          data: T
      }
    | {
          isSuccess: false
          message: string
          data?: undefined // Explicitly forbid data on failure for type safety
      }

// ============================================================================
// Stock & Molecule Types
// ============================================================================

/**
 * Represents a unique chemical molecule in the system.
 * InChiKey is the canonical identifier (unique constraint).
 * SMILES is the human-readable structure notation.
 */
export interface Molecule {
    id: string
    inchikey: string
    smiles: string
}

/**
 * Extended molecule information including stocks in which it appears.
 * Used for displaying cross-stock information in the UI.
 */
export interface MoleculeWithStocks extends Molecule {
    stocks: Array<{ id: string; name: string }>
}

/**
 * Represents a collection/library of commercially available molecules.
 * Stocks are loaded from CSV files and can have overlapping molecules.
 */
export interface Stock {
    id: string
    name: string
    description?: string
}

/**
 * DTO for displaying stock information in the UI.
 * Includes computed property (itemCount) for molecule count.
 */
export interface StockListItem extends Stock {
    itemCount: number
}

/**
 * Represents the junction table entry linking a Stock to a Molecule.
 * Ensures no duplicate molecules within a stock (unique constraint).
 */
export interface StockItem {
    id: string
    stockId: string
    moleculeId: string
}

/**
 * Search/filter parameters for querying molecules.
 */
export interface MoleculeSearchParams {
    query: string
    stockId?: string
    searchType?: 'smiles' | 'inchikey' | 'all'
    limit?: number
    offset?: number
}

/**
 * Result set from a molecule search query.
 */
export interface MoleculeSearchResult {
    molecules: Molecule[]
    total: number
    hasMore: boolean
}
