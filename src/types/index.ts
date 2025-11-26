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
    routeCount?: number // Number of predicted routes (for list views)
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
 * Includes position, status, and stock availability.
 */
export interface RouteGraphNode {
    smiles: string
    status: NodeStatus
    inStock?: boolean
    [key: string]: unknown
}

/**
 * Union type for node visual states.
 * Phase 1: "in-stock" | "default"
 * Future: Can expand to include "match" | "hallucination" | "ghost"
 */
export type NodeStatus = 'in-stock' | 'default'

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
    isGtMatch: boolean // Does this route match the ground truth?
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
    benchmarkSet: BenchmarkSet & { hasGroundTruth: boolean }
    totalRoutes: number
    totalTimeMs?: number | null // Total execution time in milliseconds
    avgRouteLength?: number
    solvabilitySummary?: Record<string, number> // stockId -> solvability percentage
    executedAt: Date
}

/**
 * Extended route information for predictions.
 * Includes solvability status across stocks.
 */
export interface ScoredRouteWithSolvability extends Route {
    solvability: Array<{
        stockId: string
        stockName: string
        isSolvable: boolean
        isGtMatch: boolean
    }>
}

/**
 * Complete prediction detail for a target.
 * Includes all routes and ground truth comparison.
 */
export interface TargetPredictionDetail {
    targetId: string
    molecule: Molecule
    routeLength: number | null
    isConvergent: boolean | null
    hasGroundTruth: boolean
    groundTruthRoute?: Route // Optional: the ground truth route for comparison
    groundTruthRank?: number // Optional: rank at which GT was found in predictions
    routes: Array<{
        route: Route
        routeNode: RouteNodeWithDetails
        solvability: Array<{
            stockId: string
            stockName: string
            isSolvable: boolean
            isGtMatch: boolean
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
}
