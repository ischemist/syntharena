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

// ============================================================================
// Benchmark & Route Types
// ============================================================================

/**
 * Represents a benchmark set - a collection of retrosynthesis problems.
 * Matches the Python BenchmarkSet model from retrocast.
 */
export interface BenchmarkSet {
    id: string
    name: string
    description?: string | null
    stockName?: string | null
    createdAt: Date
}

/**
 * DTO for displaying benchmark information in list views.
 * Includes computed property for target count.
 */
export interface BenchmarkListItem extends BenchmarkSet {
    targetCount: number
}

/**
 * Represents a single retrosynthesis problem within a benchmark.
 * Matches the Python BenchmarkTarget model.
 */
export interface BenchmarkTarget {
    id: string
    benchmarkSetId: string
    targetId: string // External ID like "n5-00123"
    moleculeId: string
    routeLength: number | null
    isConvergent: boolean | null
    metadata: string | null // JSON blob
    groundTruthRouteId: string | null
}

/**
 * Extended target information including the molecule data.
 * Used for displaying targets in the UI.
 */
export interface BenchmarkTargetWithMolecule extends BenchmarkTarget {
    molecule: Molecule
    hasGroundTruth: boolean
}

/**
 * Represents a complete synthesis route (ground truth or prediction).
 * Matches the Python Route model.
 */
export interface Route {
    id: string
    predictionRunId: string | null
    targetId: string
    rank: number
    contentHash: string
    signature: string | null
    length: number
    isConvergent: boolean
    metadata: string | null // JSON blob
}

/**
 * Lightweight route summary for list views.
 */
export interface RouteSummary {
    id: string
    rank: number
    length: number
    isConvergent: boolean
    isGroundTruth: boolean
}

/**
 * Represents a node in the route tree.
 * Each node is either a leaf (starting material) or has a synthesis step.
 */
export interface RouteNode {
    id: string
    routeId: string
    moleculeId: string
    parentId: string | null
    isLeaf: boolean
    reactionHash: string | null
    template: string | null
    metadata: string | null // JSON: reagents, solvents, mapped_smiles
}

/**
 * Extended route node with molecule and children for tree traversal.
 */
export interface RouteNodeWithDetails extends RouteNode {
    molecule: Molecule
    children: RouteNodeWithDetails[]
}

/**
 * Complete route data for visualization.
 * Includes the route metadata and full tree structure.
 */
export interface RouteVisualizationData {
    route: Route
    target: BenchmarkTargetWithMolecule
    rootNode: RouteNodeWithDetails
}

/**
 * Statistics about a benchmark set.
 */
export interface BenchmarkStats {
    totalTargets: number
    targetsWithGroundTruth: number
    avgRouteLength: number
    convergentRoutes: number
    minRouteLength: number
    maxRouteLength: number
}

/**
 * Input for creating a new benchmark set.
 */
export interface CreateBenchmarkInput {
    name: string
    description?: string
    stockName?: string
}

/**
 * Search/filter parameters for querying benchmark targets.
 */
export interface BenchmarkTargetSearchParams {
    benchmarkId: string
    page?: number
    limit?: number
    hasGroundTruth?: boolean
    minRouteLength?: number
    maxRouteLength?: number
    isConvergent?: boolean
}

/**
 * Result set from a benchmark target search query.
 */
export interface BenchmarkTargetSearchResult {
    targets: BenchmarkTargetWithMolecule[]
    total: number
    hasMore: boolean
    page: number
    limit: number
}

/**
 * Result from loading a benchmark file.
 */
export interface LoadBenchmarkResult {
    benchmarkId: string
    benchmarkName: string
    targetsLoaded: number
    moleculesCreated: number
    moleculesReused: number
    routesCreated: number
    timeElapsed: number
}
