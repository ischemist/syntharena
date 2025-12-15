import * as fs from 'fs'
import * as zlib from 'zlib'
import { Prisma } from '@prisma/client'

import type { LoadBenchmarkResult } from '@/types'
import prisma from '@/lib/db'

// ============================================================================
// Types for internal use (from Python retrocast models)
// ============================================================================

interface PythonMolecule {
    smiles: string
    inchikey: string
    synthesis_step: PythonReactionStep | null
    metadata?: Record<string, unknown>
    is_leaf?: boolean
}

interface PythonReactionStep {
    reactants: PythonMolecule[]
    mapped_smiles?: string | null
    template?: string | null
    reagents?: string[] | null
    solvents?: string[] | null
    metadata?: Record<string, unknown>
    is_convergent?: boolean
}

interface PythonRoute {
    target: PythonMolecule
    rank: number
    content_hash?: string
    signature?: string
    length?: number
    has_convergent_reaction?: boolean
    solvability?: Record<string, boolean>
    metadata?: Record<string, unknown>
}

interface PythonBenchmarkTarget {
    id: string
    smiles: string
    inchi_key: string // NOW REQUIRED: included directly in target (from Python model update)
    metadata?: Record<string, unknown>
    acceptable_routes: PythonRoute[] // Array of acceptable routes (empty = pure prediction task)
}

interface PythonBenchmarkSet {
    name: string
    description?: string
    stock_name?: string | null
    targets: Record<string, PythonBenchmarkTarget>
}

// ============================================================================
// Benchmark Loading Functions
// ============================================================================

/**
 * Parses a gzipped JSON benchmark file.
 * Decompresses and parses the JSON in a single stream.
 *
 * @param filePath - Path to .json.gz file
 * @returns Parsed benchmark data
 */
async function parseBenchmarkFile(filePath: string): Promise<PythonBenchmarkSet> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = []

        fs.createReadStream(filePath)
            .pipe(zlib.createGunzip())
            .on('data', (chunk) => {
                chunks.push(chunk)
            })
            .on('end', () => {
                try {
                    const json = Buffer.concat(chunks).toString('utf-8')
                    const data = JSON.parse(json) as PythonBenchmarkSet
                    resolve(data)
                } catch (error) {
                    reject(new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`))
                }
            })
            .on('error', (error) => {
                reject(
                    new Error(`Failed to decompress file: ${error instanceof Error ? error.message : String(error)}`)
                )
            })
    })
}

/**
 * Internal structure for building route nodes in memory before bulk insert.
 */
interface RouteNodeToCreate {
    tempId: string // Temporary ID for tracking parent-child relationships
    routeId: string
    moleculeInchikey: string
    parentTempId: string | null
    isLeaf: boolean
    template: string | null
    metadata: string | null
    smiles: string
}

/**
 * Recursively collects all molecules and nodes from a route tree in memory.
 *
 * @param molecule - Current molecule in the tree
 * @param routeId - The route ID
 * @param parentTempId - Parent's temporary ID
 * @param molecules - Map to collect unique molecules
 * @param nodes - Array to collect all nodes
 * @returns Temporary ID of the created node
 */
function collectRouteTreeData(
    molecule: PythonMolecule,
    routeId: string,
    parentTempId: string | null,
    molecules: Map<string, { smiles: string; inchikey: string }>,
    nodes: RouteNodeToCreate[],
    tempIdCounter: { value: number }
): string {
    // Add molecule to collection if not already present
    if (!molecules.has(molecule.inchikey)) {
        molecules.set(molecule.inchikey, {
            smiles: molecule.smiles,
            inchikey: molecule.inchikey,
        })
    }

    // Generate temporary ID for this node
    const tempId = `temp-${tempIdCounter.value++}`

    // Create node data
    const isLeaf = !molecule.synthesis_step
    const node: RouteNodeToCreate = {
        tempId,
        routeId,
        moleculeInchikey: molecule.inchikey,
        parentTempId,
        isLeaf,
        template: molecule.synthesis_step?.template || null,
        metadata: molecule.synthesis_step?.metadata ? JSON.stringify(molecule.synthesis_step.metadata) : null,
        smiles: molecule.smiles,
    }
    nodes.push(node)

    // Recursively process reactants
    if (molecule.synthesis_step?.reactants) {
        for (const reactant of molecule.synthesis_step.reactants) {
            collectRouteTreeData(reactant, routeId, tempId, molecules, nodes, tempIdCounter)
        }
    }

    return tempId
}

/**
 * Stores a route tree in the database using bulk operations.
 * Minimizes database queries by collecting all data in memory first,
 * then performing bulk inserts.
 *
 * @param routeId - The route ID
 * @param rootMolecule - Root molecule (target)
 * @param tx - Transaction client
 * @returns Number of new molecules created
 */
async function storeRouteTree(
    routeId: string,
    rootMolecule: PythonMolecule,
    tx: Prisma.TransactionClient
): Promise<number> {
    // Step 1: Collect all unique molecules and nodes in memory
    const moleculesMap = new Map<string, { smiles: string; inchikey: string }>()
    const nodesData: RouteNodeToCreate[] = []
    const tempIdCounter = { value: 0 }

    collectRouteTreeData(rootMolecule, routeId, null, moleculesMap, nodesData, tempIdCounter)

    // Step 2: Bulk handle molecules
    const uniqueInchikeys = Array.from(moleculesMap.keys())

    // Find existing molecules
    const existingMolecules = await tx.molecule.findMany({
        where: { inchikey: { in: uniqueInchikeys } },
        select: { id: true, inchikey: true },
    })

    const existingInchikeyToId = new Map(existingMolecules.map((m) => [m.inchikey, m.id]))

    // Create new molecules
    const newMolecules = Array.from(moleculesMap.values()).filter((m) => !existingInchikeyToId.has(m.inchikey))

    let moleculesCreated = 0
    if (newMolecules.length > 0) {
        // SQLite doesn't support skipDuplicates in createMany, so we use individual creates
        // This is still much faster than the original recursive approach
        const createdMolecules = await Promise.all(
            newMolecules.map((m) =>
                tx.molecule.create({
                    data: m,
                    select: { id: true, inchikey: true },
                })
            )
        )
        moleculesCreated = createdMolecules.length

        for (const mol of createdMolecules) {
            existingInchikeyToId.set(mol.inchikey, mol.id)
        }
    }

    // Step 3: Create all nodes with proper parent-child relationships
    // First pass: create all nodes and build a map of tempId to real ID
    const tempIdToRealId = new Map<string, string>()

    // We need to create nodes in order (parent before children)
    // Build a tree structure to ensure proper ordering
    const nodesByParent = new Map<string | null, RouteNodeToCreate[]>()
    for (const node of nodesData) {
        const parentKey = node.parentTempId
        if (!nodesByParent.has(parentKey)) {
            nodesByParent.set(parentKey, [])
        }
        nodesByParent.get(parentKey)!.push(node)
    }

    // Breadth-first creation to ensure parents are created before children
    const queue: RouteNodeToCreate[] = nodesByParent.get(null) || []
    while (queue.length > 0) {
        const currentBatch = [...queue]
        queue.length = 0

        // Create current batch
        for (const nodeData of currentBatch) {
            const moleculeId = existingInchikeyToId.get(nodeData.moleculeInchikey)
            if (!moleculeId) {
                throw new Error(`Molecule not found for inchikey: ${nodeData.moleculeInchikey}`)
            }

            const parentId = nodeData.parentTempId ? tempIdToRealId.get(nodeData.parentTempId) || null : null

            const createdNode = await tx.routeNode.create({
                data: {
                    routeId: nodeData.routeId,
                    moleculeId,
                    parentId,
                    isLeaf: nodeData.isLeaf,
                    template: nodeData.template,
                    metadata: nodeData.metadata,
                },
                select: { id: true },
            })

            tempIdToRealId.set(nodeData.tempId, createdNode.id)

            // Add children to queue
            const children = nodesByParent.get(nodeData.tempId) || []
            queue.push(...children)
        }
    }

    return moleculesCreated
}

/**
 * Internal structure for in-memory route node representation.
 */
interface InMemoryRouteNode {
    id: string
    isLeaf: boolean
    childIds: string[]
}

/**
 * Computes route length and convergence in-memory using a single database query.
 * Fetches all nodes at once and performs graph traversal in memory.
 *
 * @param routeId - The route ID
 * @param tx - Transaction client
 * @returns Object with length and isConvergent properties
 */
async function computeRouteProperties(
    routeId: string,
    tx: Prisma.TransactionClient
): Promise<{ length: number; isConvergent: boolean }> {
    // Fetch all nodes for this route in a single query
    const nodes = await tx.routeNode.findMany({
        where: { routeId },
        select: {
            id: true,
            parentId: true,
            isLeaf: true,
        },
    })

    if (nodes.length === 0) {
        return { length: 0, isConvergent: false }
    }

    // Build in-memory graph structure
    const nodeMap = new Map<string, InMemoryRouteNode>()
    let rootId: string | null = null

    for (const node of nodes) {
        nodeMap.set(node.id, {
            id: node.id,
            isLeaf: node.isLeaf,
            childIds: [],
        })

        if (node.parentId === null) {
            rootId = node.id
        }
    }

    // Build parent-child relationships
    for (const node of nodes) {
        if (node.parentId) {
            const parent = nodeMap.get(node.parentId)
            if (parent) {
                parent.childIds.push(node.id)
            }
        }
    }

    if (!rootId) {
        return { length: 0, isConvergent: false }
    }

    // Compute length using in-memory DFS
    function getDepth(nodeId: string): number {
        const node = nodeMap.get(nodeId)
        if (!node || node.childIds.length === 0) {
            return 0
        }

        const childDepths = node.childIds.map((childId) => getDepth(childId))
        return 1 + Math.max(...childDepths)
    }

    const length = getDepth(rootId)

    // Compute convergence in-memory
    let isConvergent = false
    for (const node of nodeMap.values()) {
        // Count non-leaf children
        const nonLeafChildren = node.childIds.filter((childId) => {
            const child = nodeMap.get(childId)
            return child && !child.isLeaf
        })

        if (nonLeafChildren.length >= 2) {
            isConvergent = true
            break
        }
    }

    return { length, isConvergent }
}

/**
 * Loads a benchmark from a JSON.gz file.
 * Parses targets, creates molecules, benchmark targets, and routes.
 *
 * @param filePath - Path to benchmark .json.gz file
 * @param benchmarkName - Name for the benchmark
 * @param benchmarkId - ID of the benchmark to load into
 * @param description - Optional description
 * @returns Load statistics
 * @throws Error if file not found, invalid format, or database errors
 */
export async function loadBenchmarkFromFile(
    filePath: string,
    benchmarkId: string,
    benchmarkName: string
): Promise<LoadBenchmarkResult> {
    // Validate file exists
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`)
    }

    // Parse benchmark file
    if (process.env.NODE_ENV !== 'test') {
        console.log('Parsing benchmark file...')
    }
    const benchmarkData = await parseBenchmarkFile(filePath)

    // Load targets
    const targetIds = Object.keys(benchmarkData.targets)
    if (process.env.NODE_ENV !== 'test') {
        console.log(`Loading ${targetIds.length} targets...`)
    }

    let moleculesCreated = 0
    let moleculesReused = 0
    let routesCreated = 0

    const BATCH_SIZE = 10 // Conservative batch size for route parsing

    for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
        const batch = targetIds.slice(i, i + BATCH_SIZE)

        await prisma.$transaction(async (tx) => {
            for (const externalId of batch) {
                const targetData = benchmarkData.targets[externalId]

                // Get or create target molecule
                const targetInchikey = targetData.inchi_key

                if (!targetInchikey) {
                    throw new Error(`Target ${externalId} is missing inchikey`)
                }

                let targetMol = await tx.molecule.findUnique({
                    where: { inchikey: targetInchikey },
                    select: { id: true },
                })

                if (!targetMol) {
                    targetMol = await tx.molecule.create({
                        data: {
                            smiles: targetData.smiles,
                            inchikey: targetInchikey,
                        },
                        select: { id: true },
                    })
                    moleculesCreated++
                } else {
                    moleculesReused++
                }

                // Compute routeLength and isConvergent from PRIMARY acceptable route (index 0)
                let routeLength: number | null = null
                let isConvergent: boolean | null = null
                if (targetData.acceptable_routes && targetData.acceptable_routes.length > 0) {
                    const primaryRoute = targetData.acceptable_routes[0]
                    routeLength = primaryRoute.length ?? null
                    isConvergent = primaryRoute.has_convergent_reaction ?? null
                }

                // Create benchmark target
                const benchmarkTarget = await tx.benchmarkTarget.create({
                    data: {
                        benchmarkSetId: benchmarkId,
                        targetId: externalId,
                        moleculeId: targetMol.id,
                        routeLength,
                        isConvergent,
                        metadata: targetData.metadata ? JSON.stringify(targetData.metadata) : null,
                    },
                })

                // Create acceptable routes if they exist
                if (targetData.acceptable_routes && targetData.acceptable_routes.length > 0) {
                    for (let routeIndex = 0; routeIndex < targetData.acceptable_routes.length; routeIndex++) {
                        const routeData = targetData.acceptable_routes[routeIndex]

                        // Extract route properties from file
                        const contentHash = routeData.content_hash || ''
                        const signature = routeData.signature || null

                        // Enforce data quality: acceptable routes must have contentHash and signature for deduplication
                        if (!contentHash || !signature) {
                            throw new Error(
                                `Acceptable route at index ${routeIndex} for target ${externalId} is missing contentHash or signature. Cannot ensure deduplication.`
                            )
                        }

                        // Attempt to create route or reuse if exists (handles race conditions via unique constraints)
                        let routeId: string
                        let routeLengthComputed: number
                        let routeIsConvergentComputed: boolean

                        try {
                            // Try creating the route - will fail if signature/contentHash already exists
                            const route = await tx.route.create({
                                data: {
                                    contentHash,
                                    signature,
                                    length: 0, // Will be set below
                                    isConvergent: false, // Will be set below
                                },
                                select: { id: true },
                            })
                            routeId = route.id

                            // Store route tree
                            const newMoleculesCreated = await storeRouteTree(route.id, routeData.target, tx)
                            moleculesCreated += newMoleculesCreated

                            // Use file data if available, otherwise compute
                            if (routeData.length !== undefined && routeData.has_convergent_reaction !== undefined) {
                                routeLengthComputed = routeData.length
                                routeIsConvergentComputed = routeData.has_convergent_reaction
                            } else {
                                // Compute route properties (in-memory using single query)
                                const computed = await computeRouteProperties(route.id, tx)
                                routeLengthComputed = computed.length
                                routeIsConvergentComputed = computed.isConvergent
                            }

                            // Update route with final properties
                            await tx.route.update({
                                where: { id: route.id },
                                data: {
                                    length: routeLengthComputed,
                                    isConvergent: routeIsConvergentComputed,
                                },
                            })

                            routesCreated++
                        } catch (error) {
                            // Route already exists (unique constraint violation) - find and reuse it
                            const existingRoute =
                                signature && signature !== ''
                                    ? await tx.route.findUnique({
                                          where: { signature },
                                          select: { id: true, length: true, isConvergent: true },
                                      })
                                    : await tx.route.findUnique({
                                          where: { contentHash },
                                          select: { id: true, length: true, isConvergent: true },
                                      })

                            if (!existingRoute) {
                                throw error // Not a duplicate key error, re-throw
                            }

                            routeId = existingRoute.id
                            routeLengthComputed = existingRoute.length
                            routeIsConvergentComputed = existingRoute.isConvergent
                        }

                        // Create AcceptableRoute junction record
                        await tx.acceptableRoute.create({
                            data: {
                                benchmarkTargetId: benchmarkTarget.id,
                                routeId,
                                routeIndex,
                            },
                        })
                    }
                }
            }
        })

        if (process.env.NODE_ENV !== 'test') {
            const processed = Math.min(i + BATCH_SIZE, targetIds.length)
            console.log(`Processed ${processed}/${targetIds.length} targets...`)
        }
    }

    // Update benchmark hasAcceptableRoutes flag if any acceptable routes were loaded
    if (routesCreated > 0) {
        await prisma.benchmarkSet.update({
            where: { id: benchmarkId },
            data: { hasAcceptableRoutes: true },
        })
        if (process.env.NODE_ENV !== 'test') {
            console.log('Updated benchmark hasAcceptableRoutes flag to true')
        }
    }

    if (process.env.NODE_ENV !== 'test') {
        console.log('Benchmark load complete!')
    }

    return {
        benchmarkId,
        benchmarkName,
        targetsLoaded: targetIds.length,
        moleculesCreated,
        moleculesReused,
        routesCreated,
        timeElapsed: 0, // Will be set by caller
    }
}
