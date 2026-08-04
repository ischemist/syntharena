// ============================================================================
// Shared Enums & Types (The "Canonical Pattern")
// ============================================================================

const BENCHMARK_SERIES = ['MARKET', 'REFERENCE', 'LEGACY', 'OTHER'] as const
export type BenchmarkSeries = (typeof BENCHMARK_SERIES)[number]

const SUBMISSION_TYPES = ['MAINTAINER_VERIFIED', 'COMMUNITY_SUBMITTED'] as const
export type SubmissionType = (typeof SUBMISSION_TYPES)[number]

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
const VENDOR_SOURCES = ['MC', 'LN', 'EM', 'SA', 'CB'] as const
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
interface Stock {
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
 * Result set from a molecule search query.
 */
export interface MoleculeSearchResult {
    molecules: MoleculeWithStocks[]
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
    slug: string
    description?: string | null
    stockId: string // REQUIRED: Direct reference to stock (enforced by DB)
    stock?: Stock // Optional: included when relation is loaded
    hasAcceptableRoutes: boolean // True if any target has acceptable routes
    createdAt: Date
    series: BenchmarkSeries
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
interface BenchmarkTarget {
    id: string
    benchmarkSetId: string
    targetId: string // External ID like "n5-00123"
    moleculeId: string
    smiles: string // Exact task-target representation
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
 * Represents one exact synthesis-route artifact. Topology signatures are
 * comparable but non-unique; content hashes preserve exact producer content.
 * Matches the updated Prisma Route model.
 */
export interface Route {
    id: string
    signature: string // SHA256 of topology
    contentHash: string // Exact route artifact identity, including provenance
    length: number
    isConvergent: boolean
}

/**
 * Junction table: Represents one prediction of a Route by a model.
 * Links a unique Route to a (PredictionRun, Target, Rank) tuple.
 * This is what was previously called "Route" - now separated into structure vs prediction.
 */
export interface PredictionCandidate {
    id: string
    routeId: string | null
    predictionRunId: string
    targetId: string
    benchmarkSetId: string
    rank: number // 1-indexed rank within this target/run
    metadata: string | null // JSON: scores, confidence, etc. (prediction-specific)
    failureCode: string | null
    failureMessage: string | null
    failureDetails: string | null

    // Relations (when included)
    route?: Route | null
    target?: BenchmarkTarget
}

/**
 * Shared, deduplicated reaction step data.
 * Mirrors retrocast.models.chem.ReactionStep from the Python library.
 */
interface ReactionStep {
    id: string
    reactionHash: string
}

/**
 * Represents a node in the route tree.
 * Each node is either a leaf (starting material) or has a synthesis step
 * stored in a shared ReactionStep record.
 */
interface RouteNode {
    id: string
    routeId: string
    moleculeId: string
    smiles: string
    parentId: string | null
    reactionStepId: string | null
    template: string | null
    metadata: string | null
    isLeaf: boolean
}

/**
 * Extended route node with molecule, reaction step, and children for tree traversal.
 */
export interface RouteNodeWithDetails extends RouteNode {
    molecule: Molecule
    reactionStep: ReactionStep | null
    children: RouteNodeWithDetails[]
}

/**
 * Complete route data for visualization.
 * Includes the route metadata and full tree structure.
 * For predictions, includes PredictionRoute for rank/metadata.
 */
export interface RouteVisualizationData {
    route: Route
    predictionCandidate?: PredictionCandidate
    acceptableRoutes?: Array<Route & { routeIndex: number }> // For targets with multiple acceptable routes
    target: BenchmarkTargetWithMolecule
    rootNode: RouteNodeWithDetails
}

/**
 * DTO for displaying a prediction run in a selector.
 * Contains minimal data for identifying a run.
 */
export interface PredictionRunSummary {
    id: string
    modelName: string
    modelVersion?: string
    algorithmName: string
    executedAt: Date
    routeCount: number
    availableRanks: number[]
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
 * Commercial metadata for buyable molecules.
 * Used in Maps to associate InChiKeys with vendor information.
 */
export type BuyableMetadata = {
    ppg: number | null
    source: VendorSource | null
    leadTime: string | null
    link: string | null
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
type NodeStatus =
    | 'in-stock'
    | 'default'
    | 'match'
    | 'extension'
    | 'ghost'
    | 'pred-shared'
    | 'pred-1-only'
    | 'pred-2-only'

// ============================================================================
// Route Visualization Types
// ============================================================================

// Canonical constants for runtime validation and type derivation.
const ROUTE_LAYOUT_MODES = ['prediction-only', 'side-by-side', 'diff-overlay'] as const
export const COMPARISON_MODES = ['gt-only', 'gt-vs-pred', 'pred-vs-pred'] as const
export const COMPARISON_LAYOUT_MODES = ['side-by-side', 'diff-overlay'] as const

/**
 * Describes the visual arrangement of route graphs. Type is derived from the constant.
 */
export type RouteLayoutMode = (typeof ROUTE_LAYOUT_MODES)[number]

/**
 * Defines the semantic type of comparison being performed on the target detail page.
 */
export type ComparisonMode = (typeof COMPARISON_MODES)[number]

/**
 * A specific subset of RouteLayoutMode used only for comparisons.
 */
export type ComparisonLayoutMode = (typeof COMPARISON_LAYOUT_MODES)[number]

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
    metricKey: string // Exact canonical RetroCast key
    displayName: string
    overall: MetricResult
    byStratum: Record<string, MetricResult>
}

export interface MetricEstimate {
    metricKey: string
    stratum: string
    value: number
    ciLower: number | null
    ciUpper: number | null
    nSamples: number
    reliabilityCode: ReliabilityCode | null
    reliabilityMessage: string | null
}

/** Metrics SynthArena currently renders from a canonical RetroCast analysis. */
export interface EvaluationStatistics {
    metricLabel: string
    tier0Validity: StratifiedMetric | null
    solv0: StratifiedMetric | null
    topKAccuracy: Record<string, StratifiedMetric>
}

// ============================================================================
// Model Predictions: Evaluation Types
// ============================================================================

// ============================================================================
// Model Predictions: Display DTOs
// ============================================================================

/**
 * Algorithm information for display.
 * Now includes full metadata for the algorithm detail page.
 */
export interface Algorithm {
    id: string
    name: string
    slug: string
    description?: string | null
    paper?: string | null
    codeUrl?: string | null
    bibtex?: string | null
}

/** DTO for displaying algorithm info in list views. */
export interface AlgorithmListItem extends Omit<Algorithm, 'paper' | 'codeUrl' | 'bibtex'> {
    instanceCount: number
}

/**
 * Represents a methodological grouping of model instances under a single algorithm.
 * e.g., "SynPlanner MCTS Rollout" is a family within the "SynPlanner" algorithm.
 */
export interface ModelFamily {
    id: string
    algorithmId: string
    name: string
    slug: string
    description?: string | null
    // relations (when included)
    algorithm?: Algorithm
    instances?: ModelInstance[]
}

/**
 * Model instance with structured versioning.
 * 'name' is now the specific instance name (e.g., "dms-explorer-xl-v1-2-0").
 * The combination of family + version is unique.
 */
export interface ModelInstance {
    id: string
    modelFamilyId: string
    slug: string
    description?: string | null
    versionMajor: number
    versionMinor: number
    versionPatch: number
    versionPrerelease?: string | null
    metadata?: string | null // JSON: training set info, hyperparams
    createdAt: Date
    family?: ModelFamily
}

/** DTO for displaying model instance info in list views. */
export interface ModelInstanceListItem extends ModelInstance {
    runCount: number
}

/**
 * Executive summary statistics for a model instance.
 * Computed from all prediction runs for this model version.
 */
export interface ModelInstanceExecutiveSummary {
    avgCostPerCompound: number | null // Average cost per compound across all runs
    avgDurationPerCompound: number | null // Average wall time per compound in seconds
    totalRuns: number // Total number of prediction runs
    benchmarkCount: number // Number of distinct benchmarks evaluated on
    bestTop10Accuracy: MetricResult | null // Best Top-10 accuracy across all benchmarks
}

/**
 * DTO for displaying best performance metrics for an algorithm.
 * Used in the algorithm detail page "Best Performance" section.
 */
export interface AlgorithmHighlightMetric {
    benchmarkId: string
    benchmarkName: string
    metricName: string // "Top-1" or "Top-10"
    value: number // 0-1, displayed as percentage
    ciLower: number // 95% CI lower bound
    ciUpper: number // 95% CI upper bound
    modelInstanceName: string // which instance achieved it
    modelInstanceSlug: string // for linking to model detail page
    version: string // formatted semver (e.g., "v1.2.0-beta")
}

/**
 * Prediction run summary with statistics.
 * Used for listing runs on benchmark pages.
 */
export interface PredictionRunWithStats {
    id: string
    modelInstanceId: string
    benchmarkSetId: string
    modelInstance: ModelInstance & { family: ModelFamily }
    benchmarkSet: BenchmarkSet & { hasAcceptableRoutes: boolean }
    totalRoutes: number
    hourlyCost?: number | null // USD per hour (user-specified)
    totalCost?: number | null // Pre-calculated: hourlyCost * (totalWallTime / 3600)
    totalWallTime?: number | null // Aggregate planner wall time in seconds
    avgRouteLength?: number | null
    tier0Validity?: MetricResult | null
    solv0Summary?: Record<string, { label: string; metric: MetricResult }>
    top1Accuracy?: MetricResult | null
    top10Accuracy?: MetricResult | null
    executedAt: Date
    submissionType: SubmissionType
    isRetrained?: boolean | null
}

/**
 * Complete prediction detail for a target.
 * Includes all routes and acceptable route comparison.
 * Updated to use PredictionRoute for prediction metadata.
 */
interface TargetPredictionDetail {
    targetId: string
    molecule: Molecule
    routeLength: number | null
    isConvergent: boolean | null
    hasAcceptableRoutes: boolean
    acceptableRoutes?: Array<Route & { routeIndex: number }> // Ordered by routeIndex (0 = primary)
    acceptableMatchRank?: number // Optional: rank at which first acceptable match was found
    routes: Array<{
        route: Route // The route structure
        predictionCandidate: PredictionCandidate
        routeNode: RouteNodeWithDetails
        visualizationNode: RouteVisualizationNode // Pre-computed for client (no client-side transformation needed)
        evaluations: Array<{
            metricLabel: string
            tier0Status: EvaluationStatus | null
            constraintStatus: EvaluationStatus
            matchesAcceptable: boolean | null
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
    stockId: string | null
    stock: Stock | null
    metricLabel: string
    analysisJson: string
    statistics: EvaluationStatistics
    computedAt: Date
}

export type EvaluationStatus = 'PASS' | 'FAIL' | 'NOT_EVALUATED'

/**
 * Leaderboard entry for model comparison.
 * One row per model-benchmark-evaluation combination.
 */
export interface LeaderboardEntry {
    runId: string
    /** Exact RetroCast evaluation represented by this row. */
    evaluationId: string
    benchmarkId: string
    algorithmName: string // e.g., "SynPlanner"
    algorithmSlug: string // e.g., "synplanner"
    modelFamilyName: string // e.g., "SynPlanner MCTS Rollout"
    modelName: string // Deprecated alias for modelFamilyName (kept for backward compat)
    version: string
    modelInstanceSlug: string
    benchmarkName: string
    benchmarkSeries: BenchmarkSeries
    stockName: string
    submissionType: SubmissionType
    hasAcceptableRoutes: boolean
    isRetrained: PredictionRunWithStats['isRetrained']
    metrics: {
        tier0Validity: MetricResult
        solv0: MetricResult
        solv0Label: string
        topKAccuracy?: Record<string, MetricResult> // "Top-1", "Top-5", etc.
    }
    // Runtime and cost for the immutable planner run, not RetroCast evaluation overhead
    totalWallTime?: number | null // Aggregate planner wall time in seconds
    totalCost?: number | null // Total cost in USD
}

export interface HomePageStats {
    totalAlgorithms: number
    totalModelInstances: number
    totalPredictionRuns: number
    totalUniqueRoutes: number
    totalBenchmarks: number
    stockStats: Array<{
        name: string
        moleculeCount: number
    }>
}

export interface BenchmarkOverview {
    id: string
    name: string
    slug: string
    description: string | null
    series: BenchmarkSeries
    targetCount: number
    stockName: string
    hasAcceptableRoutes: boolean
    runCount: number
}

/**
 * DTO for the target info card. FAST.
 */
export interface TargetInfo {
    targetId: string
    molecule: TargetPredictionDetail['molecule']
    routeLength: number | null
    isConvergent: boolean | null
    hasAcceptableRoutes: boolean
    acceptableMatchRank?: number
}

/**
 * Mega-DTO for the entire target display section on the run detail page.
 * Contains all pre-fetched and pre-computed data needed for rendering,
 * eliminating component-level waterfalls.
 */
export interface TargetDisplayData {
    // Core target metadata
    targetInfo: TargetInfo & { hasNoPredictions: boolean }

    // Navigation and summary data
    totalPredictions: number

    // Data for the currently selected prediction
    currentPrediction: {
        predictionCandidate: PredictionCandidate
        route: Route | null
        visualizationNode: RouteVisualizationNode | null
        evaluation?: {
            metricLabel: string
            tier0Status: EvaluationStatus | null
            constraintStatus: EvaluationStatus
            matchesAcceptable: boolean | null
        }
    } | null

    // Data for the currently selected acceptable route (if any)
    acceptableRoute: {
        visualizationNode: RouteVisualizationNode
    } | null
    totalAcceptableRoutes: number
    currentAcceptableIndex: number

    // Stock-related data for visualization
    stockInfo: {
        stockId?: string
        stockName?: string
        inStockInchiKeys: Set<string>
        buyableMetadataMap: Map<string, BuyableMetadata>
    }

    // Pass-through UI state from URL
    layout?: RouteLayoutMode
    navigation: {
        currentRank: number
        availableRanks: number[]
        previousRankHref: string | null
        nextRankHref: string | null
    }
    acceptableRouteNav?: {
        currentAcceptableIndex: number
        availableRanks: number[]
        previousRankHref: string | null
        nextRankHref: string | null
    }
}
/**
 * Mega-DTO for the entire target comparison page (`/benchmarks/[benchmarkId]/targets/[targetId]`).
 * Contains all pre-fetched and pre-computed data needed for rendering the comparison UI,
 * eliminating component-level waterfalls.
 */
export interface TargetComparisonData {
    benchmarkId: string
    targetId: string

    // All available prediction runs for this target, used to populate model selectors.
    availableRuns: PredictionRunSummary[] // Updated to use the new summary type

    // Information about the selected acceptable route for comparison.
    acceptableRoute?: {
        route: Route
        data: RouteVisualizationData
        visualizationNode: RouteVisualizationNode
        layout?: {
            nodes: Array<{ id: string; smiles: string; inchikey: string; x: number; y: number }>
            edges: Array<{ source: string; target: string }>
        }
        availableRanks: number[]
        previousRankHref: string | null
        nextRankHref: string | null
    }
    totalAcceptableRoutes: number
    currentAcceptableIndex: number

    // Information about the first selected model prediction.
    model1?: {
        runId: string
        rank: number
        name: string
        routeTree: RouteVisualizationNode
        availableRanks: number[]
        previousRankHref: string | null
        nextRankHref: string | null
    }

    // Information about the second selected model prediction.
    model2?: {
        runId: string
        rank: number
        name: string
        routeTree: RouteVisualizationNode
        availableRanks: number[]
        previousRankHref: string | null
        nextRankHref: string | null
    }

    // Fully resolved stock and buyable metadata for all molecules in view.
    stockInfo: {
        inStockInchiKeys: Set<string>
        buyableMetadataMap: Map<string, BuyableMetadata>
    }

    // UI state derived from URL params.
    currentMode: ComparisonMode
    layout: ComparisonLayoutMode
}

/**
 * A standard interface for any object with SemVer fields.
 * This ensures consistency across all functions that handle versions.
 */
export interface Versionable {
    versionMajor: number
    versionMinor: number
    versionPatch: number
    versionPrerelease?: string | null | undefined
}
