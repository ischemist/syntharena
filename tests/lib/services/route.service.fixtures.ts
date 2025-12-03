/**
 * Test fixtures for route.service tests.
 * Contains test data representing various route tree structures and Python data models.
 */

/**
 * Python model fixtures (as they come from benchmark files)
 */

export const singleMoleculePython = {
    smiles: 'C',
    inchikey: 'VNWKTOKETHGBQD-UHFFFAOYSA-N',
    is_leaf: true,
    synthesis_step: null,
}

/**
 * Linear chain: C -> CC -> CCC
 * Represents a simple linear synthesis route
 */
export const linearChainPython = {
    smiles: 'CCC',
    inchikey: 'LXKTOXZUCNLJGD-UHFFFAOYSA-N',
    is_leaf: false,
    synthesis_step: {
        reactants: [
            {
                smiles: 'CC',
                inchikey: 'OTMSDBZJAUFBTE-UHFFFAOYSA-N',
                is_leaf: false,
                synthesis_step: {
                    reactants: [
                        {
                            smiles: 'C',
                            inchikey: 'VNWKTOKETHGBQD-UHFFFAOYSA-N',
                            is_leaf: true,
                            synthesis_step: null,
                        },
                    ],
                    template: 'C.C>>CC',
                    mapped_smiles: '[C:1].[C:2]>>[C:1][C:2]',
                },
            },
        ],
        template: 'CC.C>>CCC',
        mapped_smiles: '[C:1][C:2].[C:3]>>[C:1][C:2][C:3]',
    },
}

/**
 * Convergent route: simple tree with two reactants converging
 *        Target
 *        /    \
 *      Mol1  Mol2
 *      /        \
 *   Leaf1      Leaf2
 */
export const convergentRoutePython = {
    smiles: 'CC(C)O',
    inchikey: 'LFQSCWFLJHTTHZ-UHFFFAOYSA-N',
    is_leaf: false,
    synthesis_step: {
        reactants: [
            {
                smiles: 'CC(C)',
                inchikey: 'RGHNJXZPGCOGJP-UHFFFAOYSA-N',
                is_leaf: false,
                synthesis_step: {
                    reactants: [
                        {
                            smiles: 'C',
                            inchikey: 'VNWKTOKETHGBQD-UHFFFAOYSA-N',
                            is_leaf: true,
                            synthesis_step: null,
                        },
                    ],
                    template: 'C.C>>CC(C)',
                },
            },
            {
                smiles: 'O',
                inchikey: 'XLYOFNOQVQJJNP-UHFFFAOYSA-N',
                is_leaf: true,
                synthesis_step: null,
            },
        ],
        template: 'CC(C).O>>CC(C)O',
        mapped_smiles: '[C:1][C:2][C:3].[O:4]>>[C:1][C:2][C:3][O:4]',
        is_convergent: true,
    },
}

/**
 * Complex multi-level route with multiple reactants at different levels
 */
export const complexRoutePython = {
    smiles: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O',
    inchikey: 'HEFNNWSMNKKCDL-UHFFFAOYSA-N',
    is_leaf: false,
    synthesis_step: {
        reactants: [
            {
                smiles: 'CC(C)Cc1ccc(cc1)C(C)Cl',
                inchikey: 'YOXYQUQMJMRFAH-UHFFFAOYSA-N',
                is_leaf: false,
                synthesis_step: {
                    reactants: [
                        {
                            smiles: 'CC(C)Cc1ccc(cc1)C(C)=O',
                            inchikey: 'HZSVWTZRQRCTJY-UHFFFAOYSA-N',
                            is_leaf: false,
                            synthesis_step: {
                                reactants: [
                                    {
                                        smiles: 'CC(C)Cc1ccc(cc1)CHO',
                                        inchikey: 'WQZGKKKJIJFFOK-UHFFFAOYSA-N',
                                        is_leaf: true,
                                        synthesis_step: null,
                                    },
                                    {
                                        smiles: 'CH3Li',
                                        inchikey: 'KFRHMWCHUGWWJL-UHFFFAOYSA-N',
                                        is_leaf: true,
                                        synthesis_step: null,
                                    },
                                ],
                                template: 'CC(C)Cc1ccc(cc1)CHO.CH3Li>>CC(C)Cc1ccc(cc1)C(C)=O',
                            },
                        },
                        {
                            smiles: 'HCl',
                            inchikey: 'VEXZGXHMGIIPBX-UHFFFAOYSA-N',
                            is_leaf: true,
                            synthesis_step: null,
                        },
                    ],
                    template: 'CC(C)Cc1ccc(cc1)C(C)=O.HCl>>CC(C)Cc1ccc(cc1)C(C)Cl',
                },
            },
            {
                smiles: 'CO',
                inchikey: 'OKKJLVBELUTLKV-UHFFFAOYSA-N',
                is_leaf: false,
                synthesis_step: {
                    reactants: [
                        {
                            smiles: 'C',
                            inchikey: 'VNWKTOKETHGBQD-UHFFFAOYSA-N',
                            is_leaf: true,
                            synthesis_step: null,
                        },
                        {
                            smiles: 'O',
                            inchikey: 'XLYOFNOQVQJJNP-UHFFFAOYSA-N',
                            is_leaf: true,
                            synthesis_step: null,
                        },
                    ],
                    template: 'C.O>>CO',
                },
            },
        ],
        template: 'CC(C)Cc1ccc(cc1)C(C)Cl.CO>>CC(C)Cc1ccc(cc1)C(C)C(=O)O',
        is_convergent: true,
    },
}

/**
 * Database model fixtures
 */

export const mockMolecule = (inchikey: string, smiles: string) => ({
    id: `mol-${inchikey.slice(0, 8)}`,
    inchikey,
    smiles,
    createdAt: new Date(),
})

export const mockRoute = (id: string, targetId: string, rank: number = 1) => ({
    id,
    predictionRunId: null,
    targetId,
    rank,
    contentHash: `hash-${id}`,
    signature: null,
    length: 0,
    isConvergent: false,
    metadata: null,
    createdAt: new Date(),
})

export const mockRouteNode = (id: string, routeId: string, moleculeId: string, parentId: string | null = null) => ({
    id,
    routeId,
    moleculeId,
    parentId,
    isLeaf: !parentId, // Leaf if no parent
    reactionHash: null,
    template: null,
    metadata: null,
    createdAt: new Date(),
})

export const mockBenchmarkTarget = (id: string, benchmarkSetId: string, moleculeId: string) => ({
    id,
    benchmarkSetId,
    targetId: `target-${id}`,
    moleculeId,
    routeLength: null,
    isConvergent: null,
    metadata: null,
    createdAt: new Date(),
})

// Type definitions for Python route structures
interface PythonReactionStep {
    reactants: PythonMolecule[]
    mapped_smiles?: string | null
    template?: string | null
    reagents?: string[] | null
    solvents?: string[] | null
    metadata?: Record<string, unknown>
    is_convergent?: boolean
}

interface PythonMolecule {
    smiles: string
    inchikey: string
    synthesis_step: PythonReactionStep | null
    metadata?: Record<string, unknown>
    is_leaf?: boolean
}

/**
 * Helper to create a complete tree structure with database models
 */
export const createTreeStructure = (
    routeId: string,
    pythonRoute: PythonMolecule
): {
    molecules: Map<string, { id: string; smiles: string; inchikey: string }>
    nodes: Array<{
        id: string
        routeId: string
        moleculeId: string
        parentId: string | null
        isLeaf: boolean
        template: string | null
    }>
} => {
    const molecules = new Map<string, { id: string; smiles: string; inchikey: string }>()
    const nodes: Array<{
        id: string
        routeId: string
        moleculeId: string
        parentId: string | null
        isLeaf: boolean
        template: string | null
    }> = []
    let nodeCounter = 0

    const processNode = (molecule: PythonMolecule, parentId: string | null): string => {
        const nodeId = `node-${nodeCounter++}`

        // Add molecule if not exists
        if (!molecules.has(molecule.inchikey)) {
            molecules.set(molecule.inchikey, {
                id: `mol-${molecule.inchikey.slice(0, 8)}`,
                smiles: molecule.smiles,
                inchikey: molecule.inchikey,
            })
        }

        const moleculeData = molecules.get(molecule.inchikey)!

        // Add node
        nodes.push({
            id: nodeId,
            routeId,
            moleculeId: moleculeData.id,
            parentId,
            isLeaf: !molecule.synthesis_step,
            template: molecule.synthesis_step?.template || null,
        })

        // Process reactants
        if (molecule.synthesis_step?.reactants) {
            for (const reactant of molecule.synthesis_step.reactants) {
                processNode(reactant, nodeId)
            }
        }

        return nodeId
    }

    processNode(pythonRoute, null)

    return { molecules, nodes }
}
