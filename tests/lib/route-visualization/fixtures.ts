/**
 * Test fixtures for route visualization tests.
 * Contains reusable test data representing various tree structures.
 */

import type { RouteVisualizationNode } from '@/types'

/**
 * Single node (leaf) - simplest case
 */
export const singleNode: RouteVisualizationNode = {
    smiles: 'C',
}

/**
 * Linear chain - A -> B -> C
 */
export const linearChain: RouteVisualizationNode = {
    smiles: 'C',
    children: [
        {
            smiles: 'CC',
            children: [
                {
                    smiles: 'CCC',
                },
            ],
        },
    ],
}

/**
 * Simple tree with one parent and two children
 *       A
 *      / \
 *     B   C
 */
export const simpleTree: RouteVisualizationNode = {
    smiles: 'CCCO',
    children: [
        {
            smiles: 'CCO',
        },
        {
            smiles: 'C',
        },
    ],
}

/**
 * Balanced tree - 3 levels
 *         A
 *        / \
 *       B   C
 *      / \ / \
 *     D  E F  G
 */
export const balancedTree: RouteVisualizationNode = {
    smiles: 'A',
    children: [
        {
            smiles: 'B',
            children: [{ smiles: 'D' }, { smiles: 'E' }],
        },
        {
            smiles: 'C',
            children: [{ smiles: 'F' }, { smiles: 'G' }],
        },
    ],
}

/**
 * Asymmetric tree - different depths
 *       A
 *      /|\
 *     B C D
 *    /|   |
 *   E F   G
 *         |
 *         H
 */
export const asymmetricTree: RouteVisualizationNode = {
    smiles: 'A',
    children: [
        {
            smiles: 'B',
            children: [{ smiles: 'E' }, { smiles: 'F' }],
        },
        {
            smiles: 'C',
        },
        {
            smiles: 'D',
            children: [
                {
                    smiles: 'G',
                    children: [{ smiles: 'H' }],
                },
            ],
        },
    ],
}

/**
 * Wide tree - one node with many children
 *         A
 *    / / | \ \ \
 *   B C  D  E F G
 */
export const wideTree: RouteVisualizationNode = {
    smiles: 'A',
    children: [{ smiles: 'B' }, { smiles: 'C' }, { smiles: 'D' }, { smiles: 'E' }, { smiles: 'F' }, { smiles: 'G' }],
}

/**
 * Deep tree - long linear chain
 */
export const deepTree: RouteVisualizationNode = {
    smiles: 'A',
    children: [
        {
            smiles: 'B',
            children: [
                {
                    smiles: 'C',
                    children: [
                        {
                            smiles: 'D',
                            children: [
                                {
                                    smiles: 'E',
                                    children: [{ smiles: 'F' }],
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    ],
}

/**
 * Complex realistic tree - simulates actual synthesis route
 */
export const complexTree: RouteVisualizationNode = {
    smiles: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O', // Target molecule
    children: [
        {
            smiles: 'CC(C)Cc1ccc(cc1)C(C)Cl',
            children: [
                {
                    smiles: 'CC(C)Cc1ccc(cc1)C(C)=O',
                    children: [{ smiles: 'CC(C)Cc1ccc(cc1)CHO' }, { smiles: 'CH3Li' }],
                },
                { smiles: 'HCl' },
            ],
        },
        {
            smiles: 'NaCN',
            children: [{ smiles: 'NaCl' }, { smiles: 'HCN' }],
        },
    ],
}
