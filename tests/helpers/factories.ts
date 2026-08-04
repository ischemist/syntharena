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

// ============================================================================
// 2. DB Factories (for integration tests, require active Prisma client)
// ============================================================================

import prisma from '@/lib/db'
import type { RouteNodeWithMoleculePayload } from '@/lib/services/data/route.data'

interface PythonReactionStep {
    reactants: PythonMolecule[]
}

export interface PythonMolecule {
    smiles: string
    inchikey: string
    product_of?: PythonReactionStep | null
    is_leaf?: boolean
}

export interface PythonRoute {
    target: PythonMolecule
    rank: number
}

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
        product_of: null,
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
            product_of: { reactants: [current] },
        }
    }

    return {
        target: current,
        rank,
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
            product_of: { reactants: [branch1] },
        }
    }

    // Branch 2: O -> CC -> ... (different inchikeys via prefix)
    let branch2: PythonMolecule = makeLeafMolecule('O')
    for (let i = 2; i <= branchDepth + 1; i++) {
        const smiles = carbonChainSmiles(i)
        branch2 = {
            smiles,
            inchikey: syntheticInchiKey(`branch2_${smiles}`),
            product_of: { reactants: [branch2] },
        }
    }

    // Merge
    const finalSmiles = carbonChainSmiles(depth + 2)
    const final: PythonMolecule = {
        smiles: finalSmiles,
        inchikey: syntheticInchiKey(finalSmiles),
        product_of: { reactants: [branch1, branch2] },
    }

    return {
        target: final,
        rank,
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
                product_of: null,
                is_leaf: true,
            }
        }

        const left = buildTree(currentDepth - 1)
        const right = buildTree(currentDepth - 1)

        const productSmiles = carbonChainSmiles(2 ** currentDepth)
        return {
            smiles: productSmiles,
            inchikey: syntheticInchiKey(`node_${currentDepth}_${leafCounter}`),
            product_of: { reactants: [left, right] },
        }
    }

    const target = buildTree(depth)
    return {
        target,
        rank,
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
    const isLeaf = !mol.product_of

    const node: FlatNode = {
        id: nodeId,
        routeId,
        moleculeId: `mol-${mol.inchikey.slice(0, 8)}`,
        smiles: mol.smiles,
        parentId,
        isLeaf,
        reactionStepId: null,
        template: null,
        metadata: null,
        reactionStep: null,
        molecule: {
            id: `mol-${mol.inchikey.slice(0, 8)}`,
            inchikey: mol.inchikey,
            smiles: mol.smiles,
        },
    }

    const result: FlatNode[] = [node]

    if (mol.product_of) {
        for (const reactant of mol.product_of.reactants) {
            result.push(...pythonMoleculeToFlatNodes(reactant, routeId, nodeId))
        }
    }

    return result
}

/**
 * Count total nodes in a PythonMolecule tree.
 */
export function countPythonMoleculeNodes(mol: PythonMolecule): number {
    if (!mol.product_of) return 1
    return 1 + mol.product_of.reactants.reduce((sum, r) => sum + countPythonMoleculeNodes(r), 0)
}

/**
 * Count leaf nodes in a PythonMolecule tree.
 */
export function countLeafNodes(mol: PythonMolecule): number {
    if (!mol.product_of) return 1
    return mol.product_of.reactants.reduce((sum, r) => sum + countLeafNodes(r), 0)
}

/**
 * Compute expected depth of a PythonMolecule tree (number of reaction steps on longest path).
 */
export function computeExpectedDepth(mol: PythonMolecule): number {
    if (!mol.product_of) return 0
    const childDepths = mol.product_of.reactants.map(computeExpectedDepth)
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
async function createAlgorithm(overrides: { name?: string; slug?: string } = {}) {
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
async function createModelFamily(overrides: { algorithmId: string; name?: string; slug?: string }) {
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
let modelInstanceCounter = 0

async function createModelInstance(overrides: {
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
            slug: overrides.slug ?? `test-model-${Date.now()}-${++modelInstanceCounter}`,
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
export async function createBenchmarkSet(overrides: {
    stockId: string
    id?: string
    name?: string
    slug?: string
    defaultConstraints?: Array<Record<string, unknown>>
    targetConstraints?: Record<string, Array<Record<string, unknown>>>
}) {
    const name = overrides.name ?? `test-benchmark-${Date.now()}`
    return prisma.benchmarkSet.create({
        data: {
            id: overrides.id ?? crypto.createHash('sha256').update(`test-benchmark:${name}`).digest('hex'),
            name,
            slug: overrides.slug ?? name,
            stockId: overrides.stockId,
            defaultConstraintsJson: JSON.stringify(overrides.defaultConstraints ?? []),
            targetConstraintsJson: JSON.stringify(overrides.targetConstraints ?? {}),
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
 * Create a BenchmarkTarget record with sensible defaults.
 */
export async function createBenchmarkTarget(overrides: {
    benchmarkSetId: string
    moleculeId: string
    smiles?: string
    targetId?: string
    routeLength?: number | null
    isConvergent?: boolean | null
}) {
    const molecule = await prisma.molecule.findUniqueOrThrow({ where: { id: overrides.moleculeId } })
    return prisma.benchmarkTarget.create({
        data: {
            benchmarkSetId: overrides.benchmarkSetId,
            moleculeId: overrides.moleculeId,
            smiles: overrides.smiles ?? molecule.smiles,
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
