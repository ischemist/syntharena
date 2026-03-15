/**
 * Test factories for SynthArena.
 *
 * Follows the "carbon chain" strategy from RetroCast: use simple SMILES (C, CC, CCC)
 * to test topology without chemical complexity. Deterministic fake InChiKeys via SHA256.
 *
 * Two categories:
 *  1. Pure factories (no DB) — build in-memory objects for unit tests
 *  2. DB factories — create Prisma records with sensible defaults for integration tests
 */

import crypto from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as zlib from 'zlib'

import type { MetricResult, ModelStatistics, StratifiedMetric } from '@/types'
// ============================================================================
// 2. DB Factories (for integration tests, require active Prisma client)
// ============================================================================

import prisma from '@/lib/db'
import type { RouteNodeWithMoleculePayload } from '@/lib/services/data/route.data'
import type { PythonMolecule, PythonRoute } from '@/lib/services/loaders/prediction-loader.service'
import type { RawStatsPayload } from '@/lib/services/view/leaderboard.view'

// ============================================================================
// 1. Pure Factories (no DB required)
// ============================================================================

/**
 * Generate a deterministic fake InChiKey from a string.
 * Format mimics real InChiKey structure: XXXXXXXXXXXXXX-XXXXXXXXXX-N
 */
export function syntheticInchiKey(input: string): string {
    const h = crypto.createHash('sha256').update(input).digest('hex').toUpperCase()
    return `${h.slice(0, 14)}-${h.slice(14, 24)}-N`
}

/**
 * Generate SMILES for a carbon chain of length n: C, CC, CCC, etc.
 */
export function carbonChainSmiles(n: number): string {
    if (n <= 0) throw new Error('Carbon chain length must be positive')
    return 'C'.repeat(n)
}

/**
 * Build a PythonMolecule leaf (no synthesis step).
 */
export function makeLeafMolecule(smiles: string = 'C'): PythonMolecule {
    return {
        smiles,
        inchikey: syntheticInchiKey(smiles),
        synthesis_step: null,
        is_leaf: true,
    }
}

/**
 * Build a linear PythonRoute tree using carbon chains.
 *
 * Depth 1: CC <- C           (one reaction)
 * Depth 2: CCC <- CC <- C    (two reactions)
 * Depth 3: CCCC <- CCC <- CC <- C (three reactions)
 */
export function makeLinearPythonRoute(depth: number, rank: number = 1): PythonRoute {
    if (depth < 1) throw new Error('Depth must be at least 1')

    let current: PythonMolecule = makeLeafMolecule(carbonChainSmiles(1))

    for (let i = 2; i <= depth + 1; i++) {
        const productSmiles = carbonChainSmiles(i)
        current = {
            smiles: productSmiles,
            inchikey: syntheticInchiKey(productSmiles),
            synthesis_step: { reactants: [current] },
        }
    }

    // Generate deterministic content_hash and signature from the tree
    const treeJson = JSON.stringify(current)
    const contentHash = crypto.createHash('sha256').update(treeJson).digest('hex')
    const signature = crypto.createHash('sha256').update(`sig-${treeJson}`).digest('hex')

    return {
        target: current,
        rank,
        content_hash: contentHash,
        signature,
    }
}

/**
 * Build a convergent PythonRoute where two branches merge at the top.
 *
 * Depth 2:      CCCC
 *              /    \
 *            CC      CC
 *            |       |
 *            C       O
 */
export function makeConvergentPythonRoute(depth: number, rank: number = 1): PythonRoute {
    if (depth < 2) throw new Error('Convergent routes require depth >= 2')

    const branchDepth = depth - 1

    // Branch 1: C -> CC -> ...
    let branch1: PythonMolecule = makeLeafMolecule(carbonChainSmiles(1))
    for (let i = 2; i <= branchDepth + 1; i++) {
        const smiles = carbonChainSmiles(i)
        branch1 = {
            smiles,
            inchikey: syntheticInchiKey(`branch1_${smiles}`),
            synthesis_step: { reactants: [branch1] },
        }
    }

    // Branch 2: O -> CC -> ... (different inchikeys via prefix)
    let branch2: PythonMolecule = makeLeafMolecule('O')
    for (let i = 2; i <= branchDepth + 1; i++) {
        const smiles = carbonChainSmiles(i)
        branch2 = {
            smiles,
            inchikey: syntheticInchiKey(`branch2_${smiles}`),
            synthesis_step: { reactants: [branch2] },
        }
    }

    // Merge
    const finalSmiles = carbonChainSmiles(depth + 2)
    const final: PythonMolecule = {
        smiles: finalSmiles,
        inchikey: syntheticInchiKey(finalSmiles),
        synthesis_step: { reactants: [branch1, branch2] },
    }

    const treeJson = JSON.stringify(final)
    const contentHash = crypto.createHash('sha256').update(treeJson).digest('hex')
    const signature = crypto.createHash('sha256').update(`sig-${treeJson}`).digest('hex')

    return {
        target: final,
        rank,
        content_hash: contentHash,
        signature,
    }
}

/**
 * Build a fully convergent binary tree PythonRoute.
 *
 * Depth 1: CC <- (C + C)
 * Depth 2: CCCC <- (CC <- (C+C)) + (CC <- (C+C))
 */
export function makeBinaryTreePythonRoute(depth: number, rank: number = 1): PythonRoute {
    if (depth < 1) throw new Error('Depth must be at least 1')

    let leafCounter = 0

    function buildTree(currentDepth: number): PythonMolecule {
        if (currentDepth === 0) {
            leafCounter++
            return {
                smiles: 'C',
                inchikey: syntheticInchiKey(`leaf_${leafCounter}`),
                synthesis_step: null,
                is_leaf: true,
            }
        }

        const left = buildTree(currentDepth - 1)
        const right = buildTree(currentDepth - 1)

        const productSmiles = carbonChainSmiles(2 ** currentDepth)
        return {
            smiles: productSmiles,
            inchikey: syntheticInchiKey(`node_${currentDepth}_${leafCounter}`),
            synthesis_step: { reactants: [left, right] },
        }
    }

    const target = buildTree(depth)
    const treeJson = JSON.stringify(target)
    const contentHash = crypto.createHash('sha256').update(treeJson).digest('hex')
    const signature = crypto.createHash('sha256').update(`sig-${treeJson}`).digest('hex')

    return {
        target,
        rank,
        content_hash: contentHash,
        signature,
    }
}

// ============================================================================
// Helpers to build flat node arrays for buildRouteTree tests
// ============================================================================

type FlatNode = RouteNodeWithMoleculePayload[number]

let nodeIdCounter = 0

/**
 * Reset the node ID counter between tests for deterministic output.
 */
export function resetNodeIdCounter(): void {
    nodeIdCounter = 0
}

function nextNodeId(): string {
    return `node-${++nodeIdCounter}`
}

/**
 * Build a flat array of route nodes from a PythonMolecule tree.
 * This is the shape that `buildRouteTree` expects.
 */
export function pythonMoleculeToFlatNodes(
    mol: PythonMolecule,
    routeId: string = 'route-1',
    parentId: string | null = null
): FlatNode[] {
    const nodeId = nextNodeId()
    const isLeaf = !mol.synthesis_step

    const node: FlatNode = {
        id: nodeId,
        routeId,
        moleculeId: `mol-${mol.inchikey.slice(0, 8)}`,
        parentId,
        isLeaf,
        reactionStepId: null,
        reactionStep: null,
        molecule: {
            id: `mol-${mol.inchikey.slice(0, 8)}`,
            inchikey: mol.inchikey,
            smiles: mol.smiles,
        },
    }

    const result: FlatNode[] = [node]

    if (mol.synthesis_step) {
        for (const reactant of mol.synthesis_step.reactants) {
            result.push(...pythonMoleculeToFlatNodes(reactant, routeId, nodeId))
        }
    }

    return result
}

/**
 * Count total nodes in a PythonMolecule tree.
 */
export function countPythonMoleculeNodes(mol: PythonMolecule): number {
    if (!mol.synthesis_step) return 1
    return 1 + mol.synthesis_step.reactants.reduce((sum, r) => sum + countPythonMoleculeNodes(r), 0)
}

/**
 * Count leaf nodes in a PythonMolecule tree.
 */
export function countLeafNodes(mol: PythonMolecule): number {
    if (!mol.synthesis_step) return 1
    return mol.synthesis_step.reactants.reduce((sum, r) => sum + countLeafNodes(r), 0)
}

/**
 * Compute expected depth of a PythonMolecule tree (number of reaction steps on longest path).
 */
export function computeExpectedDepth(mol: PythonMolecule): number {
    if (!mol.synthesis_step) return 0
    const childDepths = mol.synthesis_step.reactants.map(computeExpectedDepth)
    return 1 + Math.max(...childDepths, 0)
}

/**
 * Create a Stock record with sensible defaults.
 */
export async function createStock(overrides: { name?: string; description?: string } = {}) {
    return prisma.stock.create({
        data: {
            name: overrides.name ?? `test-stock-${Date.now()}`,
            description: overrides.description ?? 'Test stock',
        },
    })
}

/**
 * Create an Algorithm record with sensible defaults.
 */
export async function createAlgorithm(overrides: { name?: string; slug?: string } = {}) {
    const name = overrides.name ?? `TestAlgo-${Date.now()}`
    return prisma.algorithm.create({
        data: {
            name,
            slug: overrides.slug ?? name.toLowerCase().replace(/\s+/g, '-'),
        },
    })
}

/**
 * Create a ModelFamily record with sensible defaults.
 */
export async function createModelFamily(overrides: { algorithmId: string; name?: string; slug?: string }) {
    const name = overrides.name ?? `TestFamily-${Date.now()}`
    return prisma.modelFamily.create({
        data: {
            algorithmId: overrides.algorithmId,
            name,
            slug: overrides.slug ?? name.toLowerCase().replace(/\s+/g, '-'),
        },
    })
}

/**
 * Create a ModelInstance record with sensible defaults.
 */
export async function createModelInstance(overrides: {
    modelFamilyId: string
    slug?: string
    versionMajor?: number
    versionMinor?: number
    versionPatch?: number
    versionPrerelease?: string
}) {
    return prisma.modelInstance.create({
        data: {
            modelFamilyId: overrides.modelFamilyId,
            slug: overrides.slug ?? `test-model-${Date.now()}`,
            versionMajor: overrides.versionMajor ?? 1,
            versionMinor: overrides.versionMinor ?? 0,
            versionPatch: overrides.versionPatch ?? 0,
            versionPrerelease: overrides.versionPrerelease,
        },
    })
}

/**
 * Create a BenchmarkSet record with sensible defaults.
 */
export async function createBenchmarkSet(overrides: { stockId: string; name?: string }) {
    return prisma.benchmarkSet.create({
        data: {
            name: overrides.name ?? `test-benchmark-${Date.now()}`,
            stockId: overrides.stockId,
        },
    })
}

/**
 * Create a full model chain: Algorithm -> ModelFamily -> ModelInstance.
 * Returns all three records.
 */
export async function createFullModelChain(
    overrides: {
        algorithmName?: string
        familyName?: string
        instanceSlug?: string
    } = {}
) {
    const algorithm = await createAlgorithm({ name: overrides.algorithmName })
    const family = await createModelFamily({
        algorithmId: algorithm.id,
        name: overrides.familyName,
    })
    const instance = await createModelInstance({
        modelFamilyId: family.id,
        slug: overrides.instanceSlug,
    })
    return { algorithm, family, instance }
}

/**
 * Create a PredictionRun record with sensible defaults.
 * Requires existing modelInstance and benchmarkSet.
 */
export async function createPredictionRun(overrides: {
    modelInstanceId: string
    benchmarkSetId: string
    totalRoutes?: number
    hourlyCost?: number
}) {
    return prisma.predictionRun.create({
        data: {
            modelInstanceId: overrides.modelInstanceId,
            benchmarkSetId: overrides.benchmarkSetId,
            totalRoutes: overrides.totalRoutes ?? 0,
            hourlyCost: overrides.hourlyCost,
        },
    })
}

/**
 * Create a BenchmarkTarget record with sensible defaults.
 */
export async function createBenchmarkTarget(overrides: {
    benchmarkSetId: string
    moleculeId: string
    targetId?: string
    routeLength?: number | null
    isConvergent?: boolean | null
}) {
    return prisma.benchmarkTarget.create({
        data: {
            benchmarkSetId: overrides.benchmarkSetId,
            moleculeId: overrides.moleculeId,
            targetId: overrides.targetId ?? `target-${Date.now()}`,
            routeLength: overrides.routeLength ?? null,
            isConvergent: overrides.isConvergent ?? null,
        },
    })
}

/**
 * Create a Molecule record with sensible defaults.
 */
export async function createMolecule(overrides: { smiles?: string; inchikey?: string } = {}) {
    const smiles = overrides.smiles ?? carbonChainSmiles(1)
    return prisma.molecule.create({
        data: {
            smiles,
            inchikey: overrides.inchikey ?? syntheticInchiKey(smiles),
        },
    })
}

// ============================================================================
// File Factories (create temp files for integration tests)
// ============================================================================

/** Track temp files for cleanup */
const tempFiles: string[] = []

/**
 * Clean up all temp files created by file factories.
 * Call this in afterEach.
 */
export function cleanupTempFiles(): void {
    for (const f of tempFiles) {
        try {
            fs.unlinkSync(f)
        } catch {
            // ignore missing files
        }
    }
    tempFiles.length = 0
}

/**
 * Create a temp CSV file for stock-loader tests.
 * Returns the file path.
 */
export function createTestCsvFile(
    molecules: Array<{ smiles: string; inchikey: string }>,
    options?: { header?: string; extraLines?: string[] }
): string {
    const header = options?.header ?? 'SMILES,InChi Key'
    const lines = [header]
    for (const mol of molecules) {
        lines.push(`${mol.smiles},${mol.inchikey}`)
    }
    if (options?.extraLines) {
        lines.push(...options.extraLines)
    }

    const tmpFile = path.join(os.tmpdir(), `test-stock-${Date.now()}-${Math.random().toString(36).slice(2)}.csv`)
    fs.writeFileSync(tmpFile, lines.join('\n'), 'utf-8')
    tempFiles.push(tmpFile)
    return tmpFile
}

/**
 * Python benchmark set structure for test fixtures.
 */
interface TestBenchmarkTarget {
    id: string
    smiles: string
    inchi_key: string
    metadata?: Record<string, unknown>
    acceptable_routes: Array<{
        target: PythonMolecule
        rank: number
        content_hash?: string
        signature?: string
        length?: number
        has_convergent_reaction?: boolean
        solvability?: Record<string, boolean>
        metadata?: Record<string, unknown>
    }>
}

interface TestBenchmarkSet {
    name: string
    description?: string
    stock_name?: string | null
    targets: Record<string, TestBenchmarkTarget>
}

/**
 * Create a temp .json.gz file for benchmark-loader tests.
 * Returns the file path.
 */
export function createTestBenchmarkGzFile(data: TestBenchmarkSet): string {
    const json = JSON.stringify(data)
    const compressed = zlib.gzipSync(Buffer.from(json, 'utf-8'))

    const tmpFile = path.join(
        os.tmpdir(),
        `test-benchmark-${Date.now()}-${Math.random().toString(36).slice(2)}.json.gz`
    )
    fs.writeFileSync(tmpFile, compressed)
    tempFiles.push(tmpFile)
    return tmpFile
}

/**
 * Build a minimal valid MetricResult for test statistics.
 */
export function makeMetricResult(overrides: Partial<MetricResult> = {}): MetricResult {
    return {
        value: overrides.value ?? 0.75,
        ciLower: overrides.ciLower ?? 0.7,
        ciUpper: overrides.ciUpper ?? 0.8,
        nSamples: overrides.nSamples ?? 100,
        reliability: overrides.reliability ?? { code: 'OK', message: 'Sufficient samples' },
    }
}

/**
 * Build a minimal valid StratifiedMetric for test statistics.
 */
export function makeStratifiedMetric(overrides: Partial<StratifiedMetric> = {}): StratifiedMetric {
    return {
        metricName: overrides.metricName ?? 'Solvability',
        overall: overrides.overall ?? makeMetricResult(),
        byGroup: overrides.byGroup ?? {},
    }
}

/**
 * Build a minimal valid ModelStatistics object for test use.
 */
export function makeModelStatistics(overrides: Partial<ModelStatistics> = {}): ModelStatistics {
    return {
        solvability: overrides.solvability ?? makeStratifiedMetric({ metricName: 'Solvability' }),
        topKAccuracy: overrides.topKAccuracy,
        rankDistribution: overrides.rankDistribution,
        expectedRank: overrides.expectedRank,
        totalWallTime: overrides.totalWallTime,
        totalCpuTime: overrides.totalCpuTime,
        meanWallTime: overrides.meanWallTime,
        meanCpuTime: overrides.meanCpuTime,
    }
}

// ============================================================================
// Raw Stats Mock Factories (for leaderboard view tests)
// ============================================================================

/** A single raw metric row matching the full Prisma StratifiedMetricGroup shape. */
interface RawMetric {
    id: string
    statisticsId: string
    metricName: string
    groupKey: number | null
    value: number
    ciLower: number
    ciUpper: number
    nSamples: number
    reliabilityCode: 'OK' | 'LOW_N' | 'EXTREME_P'
    reliabilityMessage: string
}

let rawMetricIdCounter = 0

/**
 * Build a raw metric record (matching Prisma StratifiedMetricGroup shape).
 */
export function makeRawMetric(overrides: Partial<RawMetric> = {}): RawMetric {
    const id = overrides.id ?? `metric-${++rawMetricIdCounter}`
    return {
        id,
        statisticsId: overrides.statisticsId ?? `stat-ref-${rawMetricIdCounter}`,
        metricName: overrides.metricName ?? 'Solvability',
        groupKey: overrides.groupKey ?? null,
        value: overrides.value ?? 0.75,
        ciLower: overrides.ciLower ?? 0.7,
        ciUpper: overrides.ciUpper ?? 0.8,
        nSamples: overrides.nSamples ?? 100,
        reliabilityCode: (overrides.reliabilityCode ?? 'OK') as 'OK' | 'LOW_N' | 'EXTREME_P',
        reliabilityMessage: overrides.reliabilityMessage ?? 'Sufficient samples',
    }
}

let rawStatIdCounter = 0

/**
 * Build a single raw stats payload entry matching the deeply-nested Prisma
 * include shape used by findStatisticsForLeaderboard.
 *
 * This is a pure in-memory mock — no database interaction.
 */
export function makeRawStatEntry(
    overrides: {
        familyId?: string
        familyName?: string
        algorithmName?: string
        algorithmSlug?: string
        instanceSlug?: string
        versionMajor?: number
        versionMinor?: number
        versionPatch?: number
        versionPrerelease?: string | null
        stockId?: string
        stockName?: string
        stockDescription?: string | null
        runId?: string
        benchmarkSetId?: string
        benchmarkName?: string
        benchmarkSeries?: string
        hasAcceptableRoutes?: boolean
        submissionType?: string
        isRetrained?: boolean | null
        totalCost?: number | null
        totalWallTime?: number | null
        metrics?: RawMetric[]
    } = {}
): RawStatsPayload[number] {
    const id = `stat-${++rawStatIdCounter}`
    const familyId = overrides.familyId ?? `family-${rawStatIdCounter}`
    const runId = overrides.runId ?? `run-${rawStatIdCounter}`
    const benchmarkSetId = overrides.benchmarkSetId ?? `bench-${rawStatIdCounter}`
    const stockId = overrides.stockId ?? `stock-${rawStatIdCounter}`

    return {
        id,
        predictionRunId: runId,
        benchmarkSetId,
        stockId,
        statisticsJson: '{}',
        computedAt: new Date(),
        totalWallTime: overrides.totalWallTime ?? null,
        totalCpuTime: null,
        meanWallTime: null,
        meanCpuTime: null,
        stock: {
            id: stockId,
            name: overrides.stockName ?? `Stock-${rawStatIdCounter}`,
            description: overrides.stockDescription ?? null,
        },
        predictionRun: {
            id: runId,
            modelInstanceId: `instance-${rawStatIdCounter}`,
            benchmarkSetId,
            retrocastVersion: null,
            commandParams: null,
            executedAt: new Date(),
            hourlyCost: null,
            totalCost: overrides.totalCost ?? null,
            totalRoutes: 0,
            avgRouteLength: null,
            submissionType: (overrides.submissionType ?? 'COMMUNITY_SUBMITTED') as
                | 'COMMUNITY_SUBMITTED'
                | 'MAINTAINER_VERIFIED',
            isRetrained: overrides.isRetrained ?? null,
            benchmarkSet: {
                id: benchmarkSetId,
                name: overrides.benchmarkName ?? `Benchmark-${rawStatIdCounter}`,
                description: null,
                stockId,
                hasAcceptableRoutes: overrides.hasAcceptableRoutes ?? false,
                createdAt: new Date(),
                series: (overrides.benchmarkSeries ?? 'MARKET') as 'MARKET' | 'REFERENCE' | 'LEGACY' | 'OTHER',
                isListed: true,
            },
            modelInstance: {
                id: `instance-${rawStatIdCounter}`,
                modelFamilyId: familyId,
                slug: overrides.instanceSlug ?? `model-slug-${rawStatIdCounter}`,
                description: null,
                versionMajor: overrides.versionMajor ?? 1,
                versionMinor: overrides.versionMinor ?? 0,
                versionPatch: overrides.versionPatch ?? 0,
                versionPrerelease: overrides.versionPrerelease ?? null,
                metadata: null,
                createdAt: new Date(),
                family: {
                    id: familyId,
                    algorithmId: `algo-${rawStatIdCounter}`,
                    name: overrides.familyName ?? `Family-${rawStatIdCounter}`,
                    slug: `family-slug-${rawStatIdCounter}`,
                    description: null,
                    algorithm: {
                        id: `algo-${rawStatIdCounter}`,
                        name: overrides.algorithmName ?? `Algorithm-${rawStatIdCounter}`,
                        slug: overrides.algorithmSlug ?? `algo-slug-${rawStatIdCounter}`,
                        description: null,
                        paper: null,
                        codeUrl: null,
                        bibtex: null,
                    },
                },
            },
        },
        metrics: overrides.metrics ?? [makeRawMetric()],
    }
}

/**
 * Reset the raw stat ID counter between test files for deterministic output.
 */
export function resetRawStatIdCounter(): void {
    rawStatIdCounter = 0
}
