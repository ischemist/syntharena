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
 * Vendor source enumeration for buyable molecules.
 */
export const VENDOR_SOURCES = ['MC', 'LN', 'EM', 'SA', 'CB'] as const
export type VendorSource = (typeof VENDOR_SOURCES)[number]

/**
 * Human-readable vendor names mapping.
 */
export const VENDOR_NAMES: Record<VendorSource, string> = {
    MC: 'Mcule',
    LN: 'LabNetwork',
    EM: 'eMolecules',
    SA: 'Sigma Aldrich',
    CB: 'ChemBridge',
}

/**
 * Extended molecule information including stocks in which it appears.
 * Used for displaying cross-stock information in the UI.
 */
export interface MoleculeWithStocks extends Molecule {
    stocks: Array<{ id: string; name: string }>
    // Optional: includes buyable metadata when querying specific stock
    stockItem?: {
        id: string
        ppg?: number | null
        source?: VendorSource | null
        leadTime?: string | null
        link?: string | null
    }
}

/**
 * Represents a collection/library of commercially available molecules.
 * Stocks are loaded from CSV files and can have overlapping molecules.
 */
export interface Stock {
    id: string
    name: string
    description?: string | null
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
 * Includes optional commercial metadata for buyable stocks.
 */
export interface StockItem {
    id: string
    stockId: string
    moleculeId: string
    // Commercial metadata (optional, only for buyable stocks)
    ppg?: number | null // Price per gram in USD
    source?: VendorSource | null // Vendor source
    leadTime?: string | null // Lead time (e.g., '7-21days', '1week')
    link?: string | null // Vendor product page URL
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

/**
 * Filter statistics for a stock's molecules.
 * Used to populate filter dropdowns with available options.
 */
export interface StockMoleculeFilters {
    availableVendors: VendorSource[]
    counts: {
        total: number
        buyable: number
        nonBuyable: number
    }
}

// ============================================================================
// Benchmark & Route Types
// ============================================================================

/**
 * Represents a benchmark set - a collection of retrosynthesis problems.
 * Matches the Python BenchmarkSet model from retrocast.
 * Phase 9: Now requires stockId for direct reference (no runtime lookups).
 */
export interface BenchmarkSet {
    id: string
    name: string
    description?: string | null
    stockId: string // REQUIRED: Direct reference to stock (enforced by DB)
    stock?: Stock // Optional: included when relation is loaded
    hasAcceptableRoutes: boolean // True if any target has acceptable routes
    createdAt: Date
}

/**
 * DTO for displaying benchmark information in list views.
 * Includes computed property for target count.
 */
export interface BenchmarkListItem extends BenchmarkSet {
    targetCount: number
    stock: Stock // REQUIRED in list views for display
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
    routeLength: number | null // Computed from PRIMARY acceptable route (index 0)
    isConvergent: boolean | null // Computed from PRIMARY acceptable route (index 0)
    metadata: string | null // JSON blob
}

/**
 * Extended target information including the molecule data.
 * Used for displaying targets in the UI.
 */
export interface BenchmarkTargetWithMolecule extends BenchmarkTarget {
    molecule: Molecule
    hasAcceptableRoutes: boolean
    acceptableRoutesCount?: number // Number of acceptable routes for this target
    routeCount?: number // Number of predicted routes (for list views)
}

/**
 * Junction table: Links BenchmarkTarget to multiple acceptable routes.
 * Preserves array order from Python model via routeIndex (0 = primary route).
 */
export interface AcceptableRoute {
    id: string
    benchmarkTargetId: string
    routeId: string
    routeIndex: number // 0-based index (0 = primary route used for stratification)
}

/**
 * Represents a complete synthesis route structure (topology-level, unique).
 * Routes are now globally unique by signature and can be predicted multiple times.
 * Matches the updated Prisma Route model.
 */
export interface Route {
    id: string
    signature: string // NOW REQUIRED: SHA256 of topology (unique constraint)
    contentHash: string // SHA256 of full content (unique constraint)
    length: number
    isConvergent: boolean
}

/**
 * Junction table: Represents one prediction of a Route by a model.
 * Links a unique Route to a (PredictionRun, Target, Rank) tuple.
 * This is what was previously called "Route" - now separated into structure vs prediction.
 */
export interface PredictionRoute {
    id: string
    routeId: string
    predictionRunId: string
    targetId: string
    rank: number // 1-indexed rank within this target/run
    metadata: string | null // JSON: scores, confidence, etc. (prediction-specific)

    // Relations (when included)
    route?: Route
    target?: BenchmarkTarget
}

/**
 * Lightweight route summary for list views.
 * Now uses PredictionRoute for rank information.
 */
export interface RouteSummary {
    id: string
    rank: number
    length: number
    isConvergent: boolean
    matchesAcceptable: boolean // Does this route match any acceptable route?
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
 * For predictions, includes PredictionRoute for rank/metadata.
 */
export interface RouteVisualizationData {
    route: Route
    predictionRoute?: PredictionRoute // For predicted routes (includes rank, metadata)
    acceptableRoutes?: Array<Route & { routeIndex: number }> // For targets with multiple acceptable routes
    target: BenchmarkTargetWithMolecule
    rootNode: RouteNodeWithDetails
}

/**
 * Statistics about a benchmark set.
 */
export interface BenchmarkStats {
    totalTargets: number
    targetsWithAcceptableRoutes: number
    avgRouteLength: number
    convergentRoutes: number
    minRouteLength: number
    maxRouteLength: number
}

/**
 * Input for creating a new benchmark set.
 * Phase 9: stockId is now required (no more runtime lookups).
 */
export interface CreateBenchmarkInput {
    name: string
    description?: string
    stockId: string // REQUIRED: Must reference an existing stock
}

/**
 * Search/filter parameters for querying benchmark targets.
 */
export interface BenchmarkTargetSearchParams {
    benchmarkId: string
    page?: number
    limit?: number
    hasAcceptableRoutes?: boolean
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

// ============================================================================
// Route Visualization Types
// ============================================================================

/**
 * Tree structure for route visualization with SMILES and children.
 * Matches the Prisma RouteNode with molecule data flattened.
 */
export interface RouteVisualizationNode {
    smiles: string
    inchikey: string
    children?: RouteVisualizationNode[]
}

/**
 * React Flow node data with visualization metadata.
 * Includes position, status, stock availability, leaf status, and optional buyable metadata.
 */
export interface RouteGraphNode {
    smiles: string
    inchikey: string
    status: NodeStatus
    inStock?: boolean
    isLeaf?: boolean
    // Buyable metadata (when molecule is in stock with commercial data)
    ppg?: number | null
    source?: VendorSource | null
    leadTime?: string | null
    link?: string | null
    [key: string]: unknown
}

/**
 * Union type for node visual states.
 * - "in-stock" | "default": Used for single route visualization with stock highlighting
 * - "match" | "extension" | "ghost": Used for acceptable route vs prediction comparison
 *   - "match": Node present in both acceptable route and prediction
 *   - "extension": Node present in prediction but not acceptable route (potential alternative route)
 *   - "ghost": Node present in acceptable route but missing from prediction
 * - "pred-shared" | "pred-1-only" | "pred-2-only": Used for prediction vs prediction comparison
 *   - "pred-shared": Node present in both predictions (teal)
 *   - "pred-1-only": Node unique to first prediction (sky blue)
 *   - "pred-2-only": Node unique to second prediction (violet)
 */
export type NodeStatus =
    | 'in-stock'
    | 'default'
    | 'match'
    | 'extension'
    | 'ghost'
    | 'pred-shared'
    | 'pred-1-only'
    | 'pred-2-only'

/**
 * View mode for route visualization.
 * - "prediction-only": Show only the predicted route
 * - "side-by-side": Show prediction and acceptable route side by side
 * - "diff-overlay": Show merged view with diff highlighting
 */
export type RouteViewMode = 'prediction-only' | 'side-by-side' | 'diff-overlay'

/**
 * Configuration for tree layout algorithm.
 * Controls spacing and node dimensions.
 */
export interface RouteLayoutConfig {
    nodeWidth: number
    nodeHeight: number
    horizontalSpacing: number
    verticalSpacing: number
}

/**
 * Merged node structure for diff overlay visualization.
 * Combines acceptable route and prediction routes into a single tree.
 */
export interface MergedRouteNode {
    smiles: string
    inchikey: string
    status: NodeStatus
    children: MergedRouteNode[]
}

// ============================================================================
// Model Predictions: Phase 1 Types
// ============================================================================

/**
 * Reliability code from Python ReliabilityFlag.code
 * Indicates confidence in the statistical estimate.
 */
export type ReliabilityCode = 'OK' | 'LOW_N' | 'EXTREME_P'

/**
 * Reliability flag for a statistical estimate.
 * Combines code with human-readable message.
 */
export interface ReliabilityFlag {
    code: ReliabilityCode
    message: string
}

/**
 * Single metric result with confidence interval.
 * Stores value, bounds, sample size, and reliability assessment.
 */
export interface MetricResult {
    value: number // 0-1 (will be displayed as percentage in UI)
    ciLower: number // Confidence interval lower bound
    ciUpper: number // Confidence interval upper bound
    nSamples: number // Number of samples used to compute metric
    reliability: ReliabilityFlag
}

/**
 * Stratified metric breakdown by group (e.g., route length).
 * Includes overall metric and per-group breakdowns.
 */
export interface StratifiedMetric {
    metricName: string // "Solvability", "Top-1", "Top-5", etc.
    overall: MetricResult
    byGroup: Record<number, MetricResult> // groupKey -> MetricResult (e.g., routeLength -> metric)
}

/**
 * Complete statistics for one model run against one stock.
 * Parsed from ModelRunStatistics.statisticsJson.
 */
export interface ModelStatistics {
    solvability: StratifiedMetric
    topKAccuracy?: Record<string, StratifiedMetric> // "Top-1", "Top-5", "Top-10", etc. (optional - only for benchmarks with ground truth)
    rankDistribution?: {
        // Optional: probability distribution of route ranks
        rank: number
        probability: number
    }[]
    expectedRank?: number // Optional: expected rank for best solution
    // Runtime metrics (in seconds) from Python ModelStatistics
    totalWallTime?: number | null
    totalCpuTime?: number | null
    meanWallTime?: number | null
    meanCpuTime?: number | null
}

// ============================================================================
// Model Predictions: Evaluation Types
// ============================================================================

/**
 * Route with solvability information for evaluation.
 * Stripped from full Route with just essential data.
 */
export interface ScoredRoute {
    rank: number
    isSolved: boolean
    matchesAcceptable: boolean // Does this route match ANY acceptable route?
    matchedAcceptableIndex: number | null // Which acceptable route was matched (0-based, null if no match)
}

/**
 * All scored routes for one target against one stock.
 * Maps the Python TargetEvaluation model.
 */
export interface TargetEvaluation {
    targetId: string
    routes: ScoredRoute[] // Ordered by rank
}

/**
 * Complete evaluation results for a scoring run.
 * Maps Python EvaluationResults: target_id -> TargetEvaluation
 */
export interface EvaluationResults {
    [targetId: string]: TargetEvaluation
}

// ============================================================================
// Model Predictions: Display DTOs
// ============================================================================

/**
 * Algorithm information for display.
 */
export interface Algorithm {
    id: string
    name: string
    paper?: string | null
}

/**
 * Model instance with algorithm details.
 */
export interface ModelInstance {
    id: string
    algorithmId: string
    name: string
    version?: string | null
    metadata?: string | null // JSON: training set info, hyperparams
    algorithm?: Algorithm
}

/**
 * Prediction run summary with statistics.
 * Used for listing runs on benchmark pages.
 */
export interface PredictionRunWithStats {
    id: string
    modelInstanceId: string
    benchmarkSetId: string
    modelInstance: ModelInstance
    benchmarkSet: BenchmarkSet & { hasAcceptableRoutes: boolean }
    totalRoutes: number
    hourlyCost?: number | null // USD per hour (user-specified)
    totalCost?: number | null // Pre-calculated: hourlyCost * (totalWallTime / 3600)
    totalWallTime?: number | null // Total wall time in seconds (from statistics[0])
    avgRouteLength?: number | null
    solvabilitySummary?: Record<string, number> // stockId -> solvability percentage
    executedAt: Date
}

/**
 * Extended route information for predictions.
 * Includes solvability status across stocks.
 * Now combines Route (structure) with PredictionRoute (prediction metadata).
 */
export interface ScoredRouteWithSolvability {
    route: Route
    predictionRoute: PredictionRoute
    solvability: Array<{
        stockId: string
        stockName: string
        isSolvable: boolean
        matchesAcceptable: boolean
        matchedAcceptableIndex: number | null
    }>
}

/**
 * Complete prediction detail for a target.
 * Includes all routes and acceptable route comparison.
 * Updated to use PredictionRoute for prediction metadata.
 */
export interface TargetPredictionDetail {
    targetId: string
    molecule: Molecule
    routeLength: number | null
    isConvergent: boolean | null
    hasAcceptableRoutes: boolean
    acceptableRoutes?: Array<Route & { routeIndex: number }> // Ordered by routeIndex (0 = primary)
    acceptableMatchRank?: number // Optional: rank at which first acceptable match was found
    routes: Array<{
        route: Route // The route structure
        predictionRoute: PredictionRoute // The prediction metadata (rank, etc.)
        routeNode: RouteNodeWithDetails
        visualizationNode: RouteVisualizationNode // Pre-computed for client (no client-side transformation needed)
        solvability: Array<{
            stockId: string
            stockName: string
            isSolvable: boolean
            matchesAcceptable: boolean
            matchedAcceptableIndex: number | null
        }>
    }>
}

/**
 * Statistics for one model run.
 * Includes parsed statistics and metadata.
 */
export interface RunStatistics {
    id: string
    predictionRunId: string
    stockId: string
    stock: Stock
    statisticsJson: string // Raw JSON blob
    statistics?: ModelStatistics // Parsed version
    computedAt: Date
}

/**
 * Leaderboard entry for model comparison.
 * One row per model-benchmark-stock combination.
 */
export interface LeaderboardEntry {
    modelName: string
    benchmarkName: string
    stockName: string
    metrics: {
        solvability: MetricResult
        topKAccuracy?: Record<string, MetricResult> // "Top-1", "Top-5", etc.
    }
    // Runtime metrics from ModelRunStatistics
    totalWallTime?: number | null // Total wall time in seconds
    totalCost?: number | null // Total cost in USD
}
