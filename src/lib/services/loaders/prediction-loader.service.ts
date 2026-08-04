import crypto from 'crypto'
import type {
    RetrocastCheckStatus as ArtifactStatus,
    RetrocastAnalysisFile as RetrocastAnalysis,
    MetricEstimate as RetrocastAnalysisMetric,
    VerifiedEvaluationBundleForImport,
} from '@ischemist/retrocast-io'
import { hashJson, projectRetrocastRoute } from '@ischemist/routes'
import type { RetrocastMolecule, RetrocastReaction, RetrocastRoute } from '@ischemist/routes'
import { createId } from '@paralleldrive/cuid2'
import { EvaluationStatus, Prisma, ReliabilityCode } from '@prisma/client'

import prisma from '@/lib/db'
import { upsertReactionSteps } from '@/lib/services/loaders/reaction-step.helpers'

const SQLITE_BATCH_SIZE = 150

function chunks<T>(values: T[]): T[][] {
    const result: T[][] = []
    for (let index = 0; index < values.length; index += SQLITE_BATCH_SIZE) {
        result.push(values.slice(index, index + SQLITE_BATCH_SIZE))
    }
    return result
}

async function createManyInBatches<T>(values: T[], create: (batch: T[]) => Promise<unknown>): Promise<void> {
    for (const batch of chunks(values)) await create(batch)
}

// ============================================================================
// Types for Python Data (matching retrocast Pydantic models)
// ============================================================================

export interface PythonMolecule {
    smiles: string
    inchikey: string
    product_of?: PythonReactionStep | null
    annotations?: Record<string, unknown>
    is_leaf?: boolean
}

interface PythonReactionStep {
    reactants: PythonMolecule[]
    mapped_reaction_smiles?: string | null
    template?: string | null
    reagents?: string[] | null
    solvents?: string[] | null
    annotations?: Record<string, unknown>
    is_convergent?: boolean
}

export interface PythonRoute {
    target: PythonMolecule
    rank: number
    solvability?: Record<string, boolean>
    annotations?: Record<string, unknown>
    schema_version?: string
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Computes route length (number of reaction steps).
 */
export function computeRouteLength(root: PythonMolecule): number {
    const step = getProductOf(root)
    if (!step) return 0
    const childLengths = step.reactants.map(computeRouteLength)
    return 1 + Math.max(...childLengths, 0)
}

/**
 * Checks if route is convergent (two or more independent multi-step sub-syntheses merge).
 *
 * A route is convergent only when a reaction node has 2+ non-leaf reactants —
 * i.e. at least two reactants that are themselves synthesised (have their own steps).
 * A simple two-component reaction where both reactants are buyable starting materials
 * (leaves) is NOT convergent; it is just a bimolecular reaction.
 *
 * This definition matches the one used in benchmark-loader.service.ts
 * (`computeRouteProperties`): a node is convergent when it has ≥2 non-leaf children.
 */
export function isRouteConvergent(root: PythonMolecule): boolean {
    const step = getProductOf(root)
    if (!step) return false
    const reactants = step.reactants
    // Count non-leaf reactants (reactants that themselves have synthesis steps)
    const nonLeafReactants = reactants.filter((r) => getProductOf(r) !== null)
    if (nonLeafReactants.length >= 2) return true
    return reactants.some(isRouteConvergent)
}

function getProductOf(molecule: PythonMolecule): PythonReactionStep | null {
    return molecule.product_of ?? null
}

function getAnnotations(value: { annotations?: Record<string, unknown> }): Record<string, unknown> {
    return value.annotations ?? {}
}

function normalizeMoleculeForRetrocast(molecule: PythonMolecule): RetrocastMolecule {
    const step = getProductOf(molecule)
    return {
        smiles: molecule.smiles,
        inchikey: molecule.inchikey,
        ...(step ? { product_of: normalizeReactionForRetrocast(step) } : {}),
        annotations: getAnnotations(molecule),
    }
}

function normalizeReactionForRetrocast(step: PythonReactionStep): RetrocastReaction {
    return {
        reactants: step.reactants.map(normalizeMoleculeForRetrocast),
        mapped_reaction_smiles: step.mapped_reaction_smiles ?? null,
        template: step.template ?? null,
        reagents: step.reagents ?? null,
        solvents: step.solvents ?? null,
        annotations: getAnnotations(step),
    }
}

function normalizeRouteForRetrocast(route: PythonRoute): RetrocastRoute {
    return {
        target: normalizeMoleculeForRetrocast(route.target),
        annotations: getAnnotations(route),
        schema_version: '2',
    }
}

/**
 * Computes reaction hash for a synthesis step using InChIKeys.
 * Used to detect and deduplicate identical reactions across routes.
 * Aligns with Python retrocast's ReactionSignature convention.
 */
function computeReactionHash(step: PythonReactionStep, productInchikey: string): string {
    const reactantInchikeys = step.reactants.map((r) => r.inchikey).sort()
    const content = `${productInchikey}>>${reactantInchikeys.join('.')}`
    return crypto.createHash('sha256').update(content).digest('hex')
}

export interface NormalizedMetricEstimate {
    metricKey: string
    stratum: string
    value: number
    ciLower: number | null
    ciUpper: number | null
    nSamples: number
    reliabilityCode: ReliabilityCode | null
    reliabilityMessage: string | null
}

function mapReliabilityCode(code: string | undefined): ReliabilityCode {
    switch (code) {
        case undefined:
        case 'OK':
            return ReliabilityCode.OK
        case 'LOW_N':
            return ReliabilityCode.LOW_N
        case 'EXTREME_P':
            return ReliabilityCode.EXTREME_P
        default:
            throw new Error(`Unknown RetroCast reliability code: ${code}`)
    }
}

function normalizeAnalysisMetric(
    metricKey: string,
    stratum: string,
    metric: RetrocastAnalysisMetric
): NormalizedMetricEstimate {
    return {
        metricKey,
        stratum,
        value: metric.value,
        ciLower: metric.ci_low ?? null,
        ciUpper: metric.ci_high ?? null,
        nSamples: metric.count,
        reliabilityCode: metric.reliability ? mapReliabilityCode(metric.reliability.code) : null,
        reliabilityMessage: metric.reliability?.message ?? null,
    }
}

/** Preserves every canonical RetroCast metric key and exact stratum. */
export function transformRetrocastAnalysis(analysis: RetrocastAnalysis): NormalizedMetricEstimate[] {
    if (analysis.schema_version !== '2')
        throw new Error(`Unsupported analysis schema: ${String(analysis.schema_version)}`)
    const metrics = Object.entries(analysis.metrics).map(([key, metric]) => normalizeAnalysisMetric(key, '', metric))
    for (const [stratum, stratifiedMetrics] of Object.entries(analysis.by_stratum ?? {})) {
        for (const [key, metric] of Object.entries(stratifiedMetrics)) {
            metrics.push(normalizeAnalysisMetric(key, stratum, metric))
        }
    }
    return metrics
}

// ============================================================================
// Core Write Functions
// ============================================================================

/**
 * Creates or updates a PredictionRun record.
 * Use this before loading routes to ensure the run exists.
 *
 * @param benchmarkId - Benchmark set ID
 * @param modelInstanceId - Model instance ID
 * @param metadata - Optional metadata (retrocast version, command params, etc.)
 * @returns Created or updated PredictionRun
 * @throws Error if benchmark or model not found
 */
export async function createOrUpdatePredictionRun(
    benchmarkId: string,
    modelInstanceId: string,
    metadata?: {
        retrocastVersion?: string
        commandParams?: Record<string, unknown>
        executedAt?: Date
        hourlyCost?: number
    }
): Promise<{ id: string; benchmarkSetId: string; modelInstanceId: string }> {
    // Verify benchmark exists
    const benchmark = await prisma.benchmarkSet.findUnique({
        where: { id: benchmarkId },
        select: { id: true },
    })
    if (!benchmark) {
        throw new Error('Benchmark not found')
    }

    // Verify model exists
    const model = await prisma.modelInstance.findUnique({
        where: { id: modelInstanceId },
        select: { id: true },
    })
    if (!model) {
        throw new Error('Model instance not found')
    }

    // Upsert (find or create) the prediction run
    const run = await prisma.predictionRun.upsert({
        where: {
            modelInstanceId_benchmarkSetId: {
                modelInstanceId,
                benchmarkSetId: benchmarkId,
            },
        },
        update: {
            retrocastVersion: metadata?.retrocastVersion,
            commandParams: metadata?.commandParams ? JSON.stringify(metadata.commandParams) : undefined,
            executedAt: metadata?.executedAt,
            hourlyCost: metadata?.hourlyCost,
        },
        create: {
            modelInstanceId,
            benchmarkSetId: benchmarkId,
            retrocastVersion: metadata?.retrocastVersion,
            commandParams: metadata?.commandParams ? JSON.stringify(metadata.commandParams) : undefined,
            executedAt: metadata?.executedAt ?? new Date(),
            hourlyCost: metadata?.hourlyCost,
            totalRoutes: 0, // Will be updated later
        },
        select: { id: true, benchmarkSetId: true, modelInstanceId: true },
    })

    return run
}

/**
 * Internal structure for building route nodes in memory before bulk insert.
 * Reaction topology is deduplicated through reactionHash. Exact producer SMILES,
 * templates, and metadata remain on each RouteNode occurrence.
 */
interface RouteNodeToCreate {
    tempId: string // Temporary ID for tracking parent-child relationships
    routeId: string
    moleculeInchikey: string
    smiles: string
    parentTempId: string | null
    isLeaf: boolean
    reactionHash: string | null // Used for ReactionStep topology dedup
    template: string | null
    metadata: string | null
}

/**
 * Recursively collects all molecules and nodes from a route tree in memory.
 * Avoids N+1 query problem by gathering data before database operations.
 *
 * @param pythonMol - Current molecule in the tree
 * @param routeId - The route ID
 * @param parentTempId - Parent's temporary ID
 * @param molecules - Map to collect unique molecules
 * @param nodes - Array to collect all nodes
 * @param tempIdCounter - Counter for generating temporary IDs
 * @returns Temporary ID of the created node
 */
function collectRouteTreeData(
    pythonMol: PythonMolecule,
    routeId: string,
    parentTempId: string | null,
    molecules: Map<string, { smiles: string; inchikey: string }>,
    nodes: RouteNodeToCreate[],
    tempIdCounter: { value: number }
): string {
    // Add molecule to collection if not already present
    if (!molecules.has(pythonMol.inchikey)) {
        molecules.set(pythonMol.inchikey, {
            smiles: pythonMol.smiles,
            inchikey: pythonMol.inchikey,
        })
    }

    // Generate temporary ID for this node
    const tempId = `temp-${tempIdCounter.value++}`

    // Determine if this is a leaf node
    const step = getProductOf(pythonMol)
    const isLeaf = !step || pythonMol.is_leaf === true

    // Compute reaction hash if not a leaf (uses InChIKeys for canonical identity)
    let reactionHash: string | null = null
    if (step) {
        reactionHash = computeReactionHash(step, pythonMol.inchikey)
    }

    // Prepare node metadata (reagents, solvents, mapped_reaction_smiles)
    let metadata: string | null = null
    if (step) {
        const metadataObj: Record<string, unknown> = {}
        if (step.reagents) metadataObj.reagents = step.reagents
        if (step.solvents) metadataObj.solvents = step.solvents
        if (step.mapped_reaction_smiles) metadataObj.mapped_reaction_smiles = step.mapped_reaction_smiles
        const stepAnnotations = getAnnotations(step)
        if (Object.keys(stepAnnotations).length > 0) metadataObj.annotations = stepAnnotations
        if (Object.keys(metadataObj).length > 0) {
            metadata = JSON.stringify(metadataObj)
        }
    }

    // Create node data structure
    const node: RouteNodeToCreate = {
        tempId,
        routeId,
        moleculeInchikey: pythonMol.inchikey,
        smiles: pythonMol.smiles,
        parentTempId,
        isLeaf,
        reactionHash,
        template: step?.template ?? null,
        metadata,
    }
    nodes.push(node)

    // Recursively process reactants
    if (step?.reactants) {
        for (const reactant of step.reactants) {
            collectRouteTreeData(reactant, routeId, tempId, molecules, nodes, tempIdCounter)
        }
    }

    return tempId
}

function toEvaluationStatus(status: ArtifactStatus): EvaluationStatus {
    switch (status) {
        case 'pass':
            return EvaluationStatus.PASS
        case 'fail':
            return EvaluationStatus.FAIL
        case 'not_evaluated':
            return EvaluationStatus.NOT_EVALUATED
    }
}

function validityEvidenceJson(validity: Record<string, unknown>): string | null {
    const evidence = Object.fromEntries(
        Object.entries(validity).filter(([key, value]) => {
            if (key === 'tiers') return false
            if (Array.isArray(value)) return value.length > 0
            return value !== null && value !== undefined && (typeof value !== 'object' || Object.keys(value).length > 0)
        })
    )
    return Object.keys(evidence).length > 0 ? JSON.stringify(evidence) : null
}

function assertRate(name: string, actual: number, expected: RetrocastAnalysisMetric | undefined): void {
    if (!expected) throw new Error(`RetroCast analysis is missing required metric ${name}`)
    if (Math.abs(actual - expected.value) > 1e-12) {
        throw new Error(`${name} disagrees with candidate evaluation: analysis=${expected.value}, recomputed=${actual}`)
    }
}

function effectiveTaskConstraints(
    task: VerifiedEvaluationBundleForImport['evaluation']['task'],
    targetId: string
): Array<Record<string, unknown>> {
    const byKind = new Map<string, Record<string, unknown>>()
    for (const constraint of task.default_constraints) byKind.set(constraint.kind, constraint)
    for (const constraint of task.constraints[targetId] ?? []) byKind.set(constraint.kind, constraint)
    return [...byKind.values()]
}

function canonicalJson(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalJson)
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, child]) => [key, canonicalJson(child)])
        )
    }
    return value
}

function jsonSemanticallyEquals(actual: unknown, expected: unknown): boolean {
    return JSON.stringify(canonicalJson(actual)) === JSON.stringify(canonicalJson(expected))
}

function parsedJsonEquals(json: string, expected: unknown): boolean {
    try {
        return jsonSemanticallyEquals(JSON.parse(json), expected)
    } catch {
        return false
    }
}

/**
 * Validates the public Tier-0/Solv-0 contract before any database mutation.
 * The bundle reader has already verified files and candidate/evaluation alignment.
 */
export function validateEvaluationBundle(bundle: VerifiedEvaluationBundleForImport): void {
    const { manifest, evaluation, analysis } = bundle
    if (manifest.schema_version !== '2' || evaluation.schema_version !== '2' || analysis.schema_version !== '2') {
        throw new Error('SynthArena imports only RetroCast schema-v2 evaluation bundles')
    }
    if (manifest.action !== 'evaluate:v2') throw new Error(`Expected evaluate:v2 manifest, received ${manifest.action}`)
    if (!jsonSemanticallyEquals(evaluation.tiers, [0])) {
        throw new Error('SynthArena currently imports exactly the Tier-0 evaluation header')
    }

    const targets = Object.values(evaluation.targets)
    let tier0Successes = 0
    let solv0Successes = 0
    for (const target of targets) {
        const expectedConstraints = effectiveTaskConstraints(evaluation.task, target.target.id)
        if (!jsonSemanticallyEquals(target.effective_constraints, expectedConstraints)) {
            throw new Error(`Effective constraints differ from evaluation task: ${target.target.id}`)
        }
        let tier0Pass = false
        let solv0Pass = false
        for (const candidate of target.candidates) {
            if (
                candidate.route &&
                (candidate.route.target.smiles !== target.target.smiles ||
                    candidate.route.target.inchikey !== target.target.inchikey)
            ) {
                throw new Error(`Candidate route root differs from enclosing target: ${target.target.id}`)
            }
            if (
                candidate.failure &&
                ((candidate.failure.target_id != null && candidate.failure.target_id !== target.target.id) ||
                    (candidate.failure.target_smiles != null &&
                        candidate.failure.target_smiles !== target.target.smiles) ||
                    (candidate.failure.target_inchikey != null &&
                        candidate.failure.target_inchikey !== target.target.inchikey))
            ) {
                throw new Error(`Candidate failure target differs from enclosing target: ${target.target.id}`)
            }
            const tier0 = candidate.validity.tiers['0']
            if (!tier0) throw new Error(`Candidate ${target.target.id} rank ${candidate.rank} is missing Tier-0 status`)
            const tierKeys = Object.keys(candidate.validity.tiers)
            if (!jsonSemanticallyEquals(tierKeys, ['0'])) {
                throw new Error(`Candidate ${target.target.id} rank ${candidate.rank} has tiers outside header [0]`)
            }
            const acceptableIndex = candidate.matched_acceptable_index
            if (candidate.matches_acceptable !== (acceptableIndex !== null)) {
                throw new Error(
                    `Candidate ${target.target.id} rank ${candidate.rank} has incoherent acceptable match evidence`
                )
            }
            if (
                acceptableIndex !== null &&
                (!Number.isInteger(acceptableIndex) ||
                    acceptableIndex < 0 ||
                    acceptableIndex >= target.target.acceptable_routes.length)
            ) {
                throw new Error(
                    `Candidate ${target.target.id} rank ${candidate.rank} has invalid acceptable route index`
                )
            }
            if (
                candidate.failure &&
                (tier0.status === 'pass' ||
                    tier0.checks.some((check) => check.status === 'pass') ||
                    candidate.constraints.status === 'pass' ||
                    candidate.constraints.checks.some((check) => check.status === 'pass') ||
                    candidate.validity.reactions.some((reaction) =>
                        Object.values(reaction.tiers).some(
                            (result) =>
                                result?.status === 'pass' || result?.checks.some((check) => check.status === 'pass')
                        )
                    ) ||
                    candidate.matches_acceptable ||
                    acceptableIndex !== null)
            ) {
                throw new Error(`Failure candidate ${target.target.id} rank ${candidate.rank} contains pass evidence`)
            }
            if (tier0.status === 'pass') {
                tier0Pass = true
                if (candidate.constraints.status === 'pass') solv0Pass = true
            }
        }
        if (tier0Pass) tier0Successes++
        if (solv0Pass) solv0Successes++
    }
    const denominator = targets.length
    if (denominator === 0) throw new Error('Evaluation contains no benchmark targets')
    const tierKey = 'tier_0_validity_rate'
    const solvKey = `solv_0[${evaluation.metric_label}]_rate`
    assertRate(tierKey, tier0Successes / denominator, analysis.metrics[tierKey])
    assertRate(solvKey, solv0Successes / denominator, analysis.metrics[solvKey])
    if (analysis.metrics[tierKey].count !== denominator || analysis.metrics[solvKey].count !== denominator) {
        throw new Error('Tier-0/Solv-0 metric denominator does not equal benchmark target count')
    }
}

export function validateFixedTierZeroEvaluation(bundle: VerifiedEvaluationBundleForImport, stockName: string): void {
    validateEvaluationBundle(bundle)
    if (bundle.evaluation.metric_label !== stockName) {
        throw new Error(`Fixed Tier-0 metric label must equal benchmark stock: ${stockName}`)
    }
    for (const target of Object.values(bundle.evaluation.targets)) {
        const constraints = target.effective_constraints
        const constraint = constraints[0]
        if (
            constraints.length !== 1 ||
            constraint?.kind !== 'retrocast.stock_termination' ||
            constraint.stock !== stockName
        ) {
            throw new Error(
                `Fixed Tier-0 target ${target.target.id} must have exactly one stock_termination constraint for ${stockName}`
            )
        }
        for (const candidate of target.candidates) {
            const tier0 = candidate.validity.tiers['0']!
            const hasHigherTierEvidence =
                candidate.validity.reactions.length > 0 ||
                (candidate.validity.reaction_assessments?.length ?? 0) > 0 ||
                (candidate.validity.molecule_assessments?.length ?? 0) > 0 ||
                (candidate.validity.route_assessments?.length ?? 0) > 0 ||
                candidate.validity.assessment_route_binding != null
            if (hasHigherTierEvidence) {
                throw new Error(
                    `Fixed Tier-0 candidate ${target.target.id} rank ${candidate.rank} has higher-tier evidence`
                )
            }
            if (candidate.failure) {
                if (
                    tier0.status !== 'fail' ||
                    tier0.checks.length === 0 ||
                    tier0.checks.some((check) => check.status !== 'fail') ||
                    candidate.constraints.status !== 'not_evaluated' ||
                    candidate.constraints.checks.length !== 0
                ) {
                    throw new Error(
                        `Fixed Tier-0 failure ${target.target.id} rank ${candidate.rank} violates producer evidence profile`
                    )
                }
            } else if (
                tier0.status !== 'pass' ||
                tier0.checks.length !== 0 ||
                !['pass', 'fail'].includes(candidate.constraints.status) ||
                (candidate.constraints.status === 'pass' && candidate.constraints.checks.length !== 0) ||
                (candidate.constraints.status === 'fail' &&
                    (candidate.constraints.checks.length === 0 ||
                        candidate.constraints.checks.some((check) => check.status !== 'fail')))
            ) {
                throw new Error(
                    `Fixed Tier-0 route ${target.target.id} rank ${candidate.rank} violates producer evidence profile`
                )
            }
        }
    }
}

interface PreparedRoute {
    route: PythonRoute
    signature: string
    contentHash: string
    length: number
    isConvergent: boolean
}

async function resolveAndStoreRoutes(
    preparedRoutesByHash: Map<string, PreparedRoute>,
    tx: Prisma.TransactionClient
): Promise<Map<string, string>> {
    const contentHashToRouteId = new Map<string, string>()
    for (const contentHashBatch of chunks([...preparedRoutesByHash.keys()])) {
        const existing = await tx.route.findMany({
            where: { contentHash: { in: contentHashBatch } },
            select: { id: true, contentHash: true },
        })
        for (const route of existing) contentHashToRouteId.set(route.contentHash, route.id)
    }

    const newRoutes: Array<PreparedRoute & { id: string }> = []
    for (const route of preparedRoutesByHash.values()) {
        if (contentHashToRouteId.has(route.contentHash)) continue
        const id = createId()
        contentHashToRouteId.set(route.contentHash, id)
        newRoutes.push({ ...route, id })
    }

    for (let routeIndex = 0; routeIndex < newRoutes.length; routeIndex += SQLITE_BATCH_SIZE) {
        const routeBatch = newRoutes.slice(routeIndex, routeIndex + SQLITE_BATCH_SIZE)
        await tx.route.createMany({
            data: routeBatch.map(({ id, signature, contentHash, length, isConvergent }) => ({
                id,
                signature,
                contentHash,
                length,
                isConvergent,
            })),
        })

        const molecules = new Map<string, { smiles: string; inchikey: string }>()
        const nodes: RouteNodeToCreate[] = []
        const tempIdCounter = { value: 0 }
        for (const route of routeBatch) {
            collectRouteTreeData(route.route.target, route.id, null, molecules, nodes, tempIdCounter)
        }
        const moleculeIds = new Map<string, string>()
        for (const inchikeyBatch of chunks([...molecules.keys()])) {
            const existing = await tx.molecule.findMany({
                where: { inchikey: { in: inchikeyBatch } },
                select: { id: true, inchikey: true },
            })
            for (const molecule of existing) moleculeIds.set(molecule.inchikey, molecule.id)
        }
        const newMolecules = [...molecules.values()].flatMap((molecule) => {
            if (moleculeIds.has(molecule.inchikey)) return []
            const id = createId()
            moleculeIds.set(molecule.inchikey, id)
            return [{ id, ...molecule }]
        })
        await createManyInBatches(newMolecules, (batch) => tx.molecule.createMany({ data: batch }))
        const reactionIds = await upsertReactionSteps(nodes, tx)

        const nodeIds = new Map(nodes.map((node) => [node.tempId, createId()]))
        const nodesByTempId = new Map(nodes.map((node) => [node.tempId, node]))
        const depths = new Map<string, number>()
        const depthOf = (node: RouteNodeToCreate): number => {
            const cached = depths.get(node.tempId)
            if (cached !== undefined) return cached
            const parent = node.parentTempId ? nodesByTempId.get(node.parentTempId) : undefined
            if (node.parentTempId && !parent) throw new Error(`Route node parent not found: ${node.parentTempId}`)
            const depth = parent ? 1 + depthOf(parent) : 0
            depths.set(node.tempId, depth)
            return depth
        }
        const nodesByDepth = new Map<number, RouteNodeToCreate[]>()
        for (const node of nodes) {
            const depth = depthOf(node)
            const group = nodesByDepth.get(depth) ?? []
            group.push(node)
            nodesByDepth.set(depth, group)
        }
        for (const depth of [...nodesByDepth.keys()].sort((a, b) => a - b)) {
            const records = nodesByDepth.get(depth)!.map((node) => ({
                id: nodeIds.get(node.tempId)!,
                routeId: node.routeId,
                moleculeId: moleculeIds.get(node.moleculeInchikey)!,
                smiles: node.smiles,
                parentId: node.parentTempId ? nodeIds.get(node.parentTempId)! : null,
                reactionStepId: node.reactionHash ? (reactionIds.get(node.reactionHash) ?? null) : null,
                template: node.template,
                metadata: node.metadata,
                isLeaf: node.isLeaf,
            }))
            await createManyInBatches(records, (batch) => tx.routeNode.createMany({ data: batch }))
        }
    }
    return contentHashToRouteId
}

function uniqueEvaluationStockName(bundle: VerifiedEvaluationBundleForImport): string | null {
    const stockNames = new Set<string>()
    for (const target of Object.values(bundle.evaluation.targets)) {
        for (const constraint of target.effective_constraints) {
            if (constraint.kind === 'retrocast.stock_termination' && typeof constraint.stock === 'string') {
                stockNames.add(constraint.stock)
            }
        }
    }
    return stockNames.size === 1 ? ([...stockNames][0] ?? null) : null
}

/**
 * Imports one verified fused evaluation bundle. It projects and persists one
 * target at a time inside a single bundle-level transaction, bounding the
 * importer's working set without ever exposing a partially imported run.
 */
export async function importEvaluationBundle(
    predictionRunId: string,
    bundle: VerifiedEvaluationBundleForImport
): Promise<{ candidates: number; routes: number; failures: number; metrics: number }> {
    validateEvaluationBundle(bundle)

    return prisma.$transaction(
        async (tx) => {
            const run = await tx.predictionRun.findUnique({
                where: { id: predictionRunId },
                select: {
                    id: true,
                    benchmarkSetId: true,
                    executionStatsSha256: true,
                    timedTargets: true,
                    totalWallTime: true,
                    totalCpuTime: true,
                    meanWallTime: true,
                    meanCpuTime: true,
                    benchmarkSet: {
                        select: { defaultConstraintsJson: true, targetConstraintsJson: true },
                    },
                },
            })
            if (!run) throw new Error(`Prediction run not found: ${predictionRunId}`)
            if (
                !parsedJsonEquals(
                    run.benchmarkSet.defaultConstraintsJson,
                    bundle.evaluation.task.default_constraints
                ) ||
                !parsedJsonEquals(run.benchmarkSet.targetConstraintsJson, bundle.evaluation.task.constraints)
            ) {
                throw new Error('Evaluation task constraints differ from canonical benchmark definition')
            }
            const targetRows = await tx.benchmarkTarget.findMany({
                where: { benchmarkSetId: run.benchmarkSetId },
                select: {
                    id: true,
                    targetId: true,
                    smiles: true,
                    molecule: { select: { inchikey: true } },
                    acceptableRoutes: {
                        orderBy: { routeIndex: 'asc' },
                        select: { route: { select: { contentHash: true } } },
                    },
                },
            })
            const targetIds = new Map(targetRows.map((target) => [target.targetId, target.id]))
            const artifactTargetIds = Object.keys(bundle.evaluation.targets)
            const taskTargetIds = Object.keys(bundle.evaluation.task.targets)
            if (
                targetRows.length !== artifactTargetIds.length ||
                targetRows.length !== taskTargetIds.length ||
                artifactTargetIds.some((id) => !targetIds.has(id)) ||
                taskTargetIds.some((id) => !targetIds.has(id))
            ) {
                throw new Error('Evaluation targets do not exactly match the prediction run benchmark')
            }
            for (const targetRow of targetRows) {
                const taskTarget = bundle.evaluation.task.targets[targetRow.targetId]
                const evaluatedTarget = bundle.evaluation.targets[targetRow.targetId]?.target
                if (!taskTarget || !evaluatedTarget || taskTarget.id !== targetRow.targetId) {
                    throw new Error(`Evaluation task target identity differs from benchmark: ${targetRow.targetId}`)
                }
                for (const artifactTarget of [taskTarget, evaluatedTarget]) {
                    if (
                        artifactTarget.id !== targetRow.targetId ||
                        artifactTarget.smiles !== targetRow.smiles ||
                        artifactTarget.inchikey !== targetRow.molecule.inchikey
                    ) {
                        throw new Error(
                            `Evaluation task target chemistry differs from benchmark: ${targetRow.targetId}`
                        )
                    }
                    const acceptableHashes = artifactTarget.acceptable_routes.map((route) =>
                        hashJson(normalizeRouteForRetrocast({ ...route, rank: 1 } as PythonRoute))
                    )
                    const storedHashes = targetRow.acceptableRoutes.map((acceptable) => acceptable.route.contentHash)
                    if (
                        acceptableHashes.length !== storedHashes.length ||
                        acceptableHashes.some((hash, index) => hash !== storedHashes[index])
                    ) {
                        throw new Error(
                            `Evaluation task acceptable routes differ from benchmark: ${targetRow.targetId}`
                        )
                    }
                }
            }
            const stockName = uniqueEvaluationStockName(bundle)
            const stock = stockName ? await tx.stock.findUnique({ where: { name: stockName } }) : null
            if (stockName && !stock) throw new Error(`Stock not found for evaluation constraint: ${stockName}`)
            const stockSource = stock
                ? bundle.manifest.source_files.find((file) => file.path.includes(stock.name))
                : undefined
            if (stock?.sourceSha256 && stockSource?.sha256 !== stock.sourceSha256) {
                throw new Error(`Evaluation stock source differs from canonical stock input: ${stock.name}`)
            }

            // Replace only this evaluation identity. Candidate slots belong to
            // the planner run and may be shared by multiple task labels.
            await tx.runEvaluation.deleteMany({
                where: { predictionRunId, metricLabel: bundle.evaluation.metric_label },
            })

            const existingCandidateCount = await tx.predictionCandidate.count({ where: { predictionRunId } })
            const runtime = bundle.analysis.runtime
            const executionStatsSource = bundle.manifest.source_files.find((file) =>
                file.path.endsWith('execution_stats.json.gz')
            )
            if (!executionStatsSource) throw new Error('Bundle manifest does not track planner execution stats')
            const reuseCandidateSet = existingCandidateCount > 0 || run.executionStatsSha256 !== null
            if (
                reuseCandidateSet &&
                (run.executionStatsSha256 !== executionStatsSource.sha256 ||
                    run.timedTargets !== runtime.timed_target_count ||
                    run.totalWallTime !== runtime.total_wall_time ||
                    run.totalCpuTime !== runtime.total_cpu_time ||
                    run.meanWallTime !== runtime.mean_wall_time ||
                    run.meanCpuTime !== runtime.mean_cpu_time)
            ) {
                throw new Error('Evaluation planner execution evidence differs from the existing prediction run')
            }

            const evaluationId = createId()
            const taskWithoutTargets = { ...bundle.evaluation.task, targets: undefined }
            await tx.runEvaluation.create({
                data: {
                    id: evaluationId,
                    predictionRunId,
                    benchmarkSetId: run.benchmarkSetId,
                    stockId: stock?.id ?? null,
                    metricLabel: bundle.evaluation.metric_label,
                    evaluatedTiers: JSON.stringify(bundle.evaluation.tiers),
                    taskJson: JSON.stringify(taskWithoutTargets),
                    parametersJson: JSON.stringify(bundle.manifest.parameters),
                    analysisJson: JSON.stringify(bundle.analysis),
                    manifestJson: JSON.stringify(bundle.manifest),
                    manifestSha256: bundle.manifestSha256,
                    artifactSchema: bundle.manifest.schema_version,
                    retrocastVersion: bundle.manifest.retrocast_version,
                    createdAt: new Date(bundle.manifest.created_at),
                },
            })

            let candidateCount = 0
            let failureCount = 0
            let successfulRoutes = 0
            let totalRouteLength = 0
            for (const [externalTargetId, target] of Object.entries(bundle.evaluation.targets)) {
                const targetId = targetIds.get(externalTargetId)!
                const preparedRoutesByHash = new Map<string, PreparedRoute>()
                const routeHashByRank = new Map<number, string>()
                for (const candidate of target.candidates) {
                    candidateCount++
                    if (!candidate.route) {
                        failureCount++
                        continue
                    }
                    successfulRoutes++
                    const route = { ...candidate.route, rank: candidate.rank } as PythonRoute
                    const normalized = normalizeRouteForRetrocast(route)
                    const contentHash = hashJson(normalized)
                    const projection = projectRetrocastRoute(normalized)
                    routeHashByRank.set(candidate.rank, contentHash)
                    totalRouteLength += projection.route.length
                    if (!preparedRoutesByHash.has(contentHash)) {
                        preparedRoutesByHash.set(contentHash, {
                            route,
                            signature: projection.route.signature,
                            contentHash,
                            length: projection.route.length,
                            isConvergent: projection.route.hasConvergentReaction,
                        })
                    }
                }
                const contentHashToRouteId = await resolveAndStoreRoutes(preparedRoutesByHash, tx)
                const candidateRecords: Prisma.PredictionCandidateCreateManyInput[] = target.candidates.map(
                    (candidate) => {
                        const id = createId()
                        if (candidate.route) {
                            const routeHash = routeHashByRank.get(candidate.rank)
                            if (!routeHash) {
                                throw new Error(`Prepared route not found: ${externalTargetId} rank ${candidate.rank}`)
                            }
                            const routeId = contentHashToRouteId.get(routeHash)
                            if (!routeId) throw new Error(`Stored route not found: ${routeHash}`)
                            return {
                                id,
                                routeId,
                                predictionRunId,
                                targetId,
                                benchmarkSetId: run.benchmarkSetId,
                                rank: candidate.rank,
                                metadata: JSON.stringify(candidate.route.annotations ?? {}),
                            }
                        }
                        return {
                            id,
                            predictionRunId,
                            targetId,
                            benchmarkSetId: run.benchmarkSetId,
                            rank: candidate.rank,
                            failureCode: candidate.failure.code,
                            failureMessage: candidate.failure.message,
                            failureDetails: JSON.stringify(candidate.failure),
                        }
                    }
                )

                const candidateIdsByRank = new Map<number, string>()
                if (!reuseCandidateSet) {
                    await createManyInBatches(candidateRecords, (batch) =>
                        tx.predictionCandidate.createMany({ data: batch })
                    )
                    for (const candidate of candidateRecords) candidateIdsByRank.set(candidate.rank, candidate.id!)
                } else {
                    const existingCandidates = await tx.predictionCandidate.findMany({
                        where: { predictionRunId, targetId },
                    })
                    const existingByRank = new Map(existingCandidates.map((candidate) => [candidate.rank, candidate]))
                    if (existingCandidates.length !== candidateRecords.length) {
                        throw new Error('Evaluation candidate slots do not match the existing prediction run')
                    }
                    for (const candidate of candidateRecords) {
                        const existing = existingByRank.get(candidate.rank)
                        if (
                            !existing ||
                            existing.routeId !== (candidate.routeId ?? null) ||
                            existing.failureCode !== (candidate.failureCode ?? null) ||
                            existing.failureMessage !== (candidate.failureMessage ?? null) ||
                            existing.failureDetails !== (candidate.failureDetails ?? null) ||
                            existing.metadata !== (candidate.metadata ?? null)
                        ) {
                            throw new Error('Evaluation candidates differ from the existing prediction run')
                        }
                        candidateIdsByRank.set(candidate.rank, existing.id)
                    }
                }

                const targetEvaluationId = createId()
                await tx.targetEvaluation.create({
                    data: {
                        id: targetEvaluationId,
                        runEvaluationId: evaluationId,
                        predictionRunId,
                        targetId,
                        benchmarkSetId: run.benchmarkSetId,
                        effectiveConstraintsJson: JSON.stringify(target.effective_constraints),
                        wallTime: target.wall_time ?? null,
                        cpuTime: target.cpu_time ?? null,
                    },
                })

                const candidateEvaluations: Prisma.CandidateEvaluationCreateManyInput[] = []
                const tierResults: Prisma.CandidateTierResultCreateManyInput[] = []
                for (const candidate of target.candidates) {
                    const candidateId = candidateIdsByRank.get(candidate.rank)
                    if (!candidateId) throw new Error(`Candidate not found: ${externalTargetId} rank ${candidate.rank}`)
                    const candidateEvaluationId = createId()
                    candidateEvaluations.push({
                        id: candidateEvaluationId,
                        runEvaluationId: evaluationId,
                        targetEvaluationId,
                        predictionRunId,
                        targetId,
                        benchmarkSetId: run.benchmarkSetId,
                        candidateId,
                        constraintStatus: toEvaluationStatus(candidate.constraints.status),
                        constraintChecksJson: candidate.constraints.checks
                            ? JSON.stringify(candidate.constraints.checks)
                            : null,
                        validityEvidenceJson: validityEvidenceJson(
                            candidate.validity as unknown as Record<string, unknown>
                        ),
                        matchesAcceptable: candidate.matches_acceptable,
                        matchedAcceptableIndex: candidate.matched_acceptable_index ?? null,
                    })
                    for (const [tier, result] of Object.entries(candidate.validity.tiers)) {
                        tierResults.push({
                            id: createId(),
                            candidateEvaluationId,
                            tier: Number(tier),
                            status: toEvaluationStatus(result.status),
                            checksJson: result.checks ? JSON.stringify(result.checks) : null,
                        })
                    }
                }
                await createManyInBatches(candidateEvaluations, (batch) =>
                    tx.candidateEvaluation.createMany({ data: batch })
                )
                await createManyInBatches(tierResults, (batch) => tx.candidateTierResult.createMany({ data: batch }))
            }
            if (reuseCandidateSet && existingCandidateCount !== candidateCount) {
                throw new Error('Evaluation candidate slots do not match the existing prediction run')
            }

            const metrics = transformRetrocastAnalysis(bundle.analysis).map((metric) => ({
                id: createId(),
                runEvaluationId: evaluationId,
                ...metric,
            }))
            await createManyInBatches(metrics, (batch) => tx.metricEstimate.createMany({ data: batch }))

            const averageLength = successfulRoutes === 0 ? null : totalRouteLength / successfulRoutes
            await tx.predictionRun.update({
                where: { id: predictionRunId },
                data: {
                    retrocastVersion: bundle.manifest.retrocast_version,
                    commandParams: JSON.stringify(bundle.manifest.parameters),
                    executionStatsPath: executionStatsSource.path,
                    executionStatsSha256: executionStatsSource.sha256,
                    timedTargets: runtime.timed_target_count,
                    totalWallTime: runtime.total_wall_time,
                    totalCpuTime: runtime.total_cpu_time,
                    meanWallTime: runtime.mean_wall_time,
                    meanCpuTime: runtime.mean_cpu_time,
                    totalCandidates: candidateCount,
                    totalFailures: failureCount,
                    totalRoutes: successfulRoutes,
                    avgRouteLength: averageLength,
                },
            })
            return {
                candidates: candidateCount,
                routes: successfulRoutes,
                failures: failureCount,
                metrics: metrics.length,
            }
        },
        { maxWait: 60_000, timeout: 30 * 60_000 }
    )
}

/**
 * Calculates and updates the total cost for a PredictionRun.
 * Call this after loading statistics to populate totalCost based on hourlyCost and totalWallTime.
 *
 * Formula: totalCost = hourlyCost * (totalWallTime / 3600)
 *
 * @param predictionRunId - PredictionRun ID
 * @returns Updated PredictionRun with totalCost, or null if cost cannot be calculated
 * @throws Error if run not found
 */
export async function updatePredictionRunCost(predictionRunId: string): Promise<{
    id: string
    hourlyCost: number
    totalCost: number
} | null> {
    // Get the run with its hourly cost
    const run = await prisma.predictionRun.findUnique({
        where: { id: predictionRunId },
        select: { id: true, hourlyCost: true, totalWallTime: true },
    })

    if (!run) {
        throw new Error(`Prediction run not found: ${predictionRunId}`)
    }

    // If no hourly cost specified, can't calculate total cost
    if (!run.hourlyCost) {
        return null
    }

    // Planner cost must use planner execution time, not RetroCast evaluation time.
    if (!run.totalWallTime) {
        return null
    }

    // Calculate total cost: hourlyCost * (totalWallTime / 3600)
    // totalWallTime is in seconds, convert to hours
    const totalCost = run.hourlyCost * (run.totalWallTime / 3600)

    // Update the run with calculated cost
    const updatedRun = await prisma.predictionRun.update({
        where: { id: predictionRunId },
        data: { totalCost },
        select: {
            id: true,
            hourlyCost: true,
            totalCost: true,
        },
    })

    return {
        id: updatedRun.id,
        hourlyCost: updatedRun.hourlyCost!,
        totalCost: updatedRun.totalCost!,
    }
}
