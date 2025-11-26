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
    inchikey: 'VNWKTOKETHGBQD-UHFFFAOYSA-N',
}

/**
 * Linear chain - A -> B -> C
 */
export const linearChain: RouteVisualizationNode = {
    smiles: 'C',
    inchikey: 'VNWKTOKETHGBQD-UHFFFAOYSA-N',
    children: [
        {
            smiles: 'CC',
            inchikey: 'OTMSDBZUPAUEDD-UHFFFAOYSA-N',
            children: [
                {
                    smiles: 'CCC',
                    inchikey: 'ATUOYWHBWRKTHZ-UHFFFAOYSA-N',
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
    inchikey: 'BDERNNFJNOPAEC-UHFFFAOYSA-N',
    children: [
        {
            smiles: 'CCO',
            inchikey: 'LFQSCWFLJHTTHZ-UHFFFAOYSA-N',
        },
        {
            smiles: 'C',
            inchikey: 'VNWKTOKETHGBQD-UHFFFAOYSA-N',
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
    inchikey: 'INCHIKEY-A',
    children: [
        {
            smiles: 'B',
            inchikey: 'INCHIKEY-B',
            children: [
                { smiles: 'D', inchikey: 'INCHIKEY-D' },
                { smiles: 'E', inchikey: 'INCHIKEY-E' },
            ],
        },
        {
            smiles: 'C',
            inchikey: 'INCHIKEY-C',
            children: [
                { smiles: 'F', inchikey: 'INCHIKEY-F' },
                { smiles: 'G', inchikey: 'INCHIKEY-G' },
            ],
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
    inchikey: 'INCHIKEY-A',
    children: [
        {
            smiles: 'B',
            inchikey: 'INCHIKEY-B',
            children: [
                { smiles: 'E', inchikey: 'INCHIKEY-E' },
                { smiles: 'F', inchikey: 'INCHIKEY-F' },
            ],
        },
        {
            smiles: 'C',
            inchikey: 'INCHIKEY-C',
        },
        {
            smiles: 'D',
            inchikey: 'INCHIKEY-D',
            children: [
                {
                    smiles: 'G',
                    inchikey: 'INCHIKEY-G',
                    children: [{ smiles: 'H', inchikey: 'INCHIKEY-H' }],
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
    inchikey: 'INCHIKEY-A',
    children: [
        { smiles: 'B', inchikey: 'INCHIKEY-B' },
        { smiles: 'C', inchikey: 'INCHIKEY-C' },
        { smiles: 'D', inchikey: 'INCHIKEY-D' },
        { smiles: 'E', inchikey: 'INCHIKEY-E' },
        { smiles: 'F', inchikey: 'INCHIKEY-F' },
        { smiles: 'G', inchikey: 'INCHIKEY-G' },
    ],
}

/**
 * Deep tree - long linear chain
 */
export const deepTree: RouteVisualizationNode = {
    smiles: 'A',
    inchikey: 'INCHIKEY-A',
    children: [
        {
            smiles: 'B',
            inchikey: 'INCHIKEY-B',
            children: [
                {
                    smiles: 'C',
                    inchikey: 'INCHIKEY-C',
                    children: [
                        {
                            smiles: 'D',
                            inchikey: 'INCHIKEY-D',
                            children: [
                                {
                                    smiles: 'E',
                                    inchikey: 'INCHIKEY-E',
                                    children: [{ smiles: 'F', inchikey: 'INCHIKEY-F' }],
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
    inchikey: 'INCHIKEY-TARGET',
    children: [
        {
            smiles: 'CC(C)Cc1ccc(cc1)C(C)Cl',
            inchikey: 'INCHIKEY-CHLORO',
            children: [
                {
                    smiles: 'CC(C)Cc1ccc(cc1)C(C)=O',
                    inchikey: 'INCHIKEY-KETONE',
                    children: [
                        { smiles: 'CC(C)Cc1ccc(cc1)CHO', inchikey: 'INCHIKEY-ALDEHYDE' },
                        { smiles: 'CH3Li', inchikey: 'INCHIKEY-MELI' },
                    ],
                },
                { smiles: 'HCl', inchikey: 'INCHIKEY-HCL' },
            ],
        },
        {
            smiles: 'NaCN',
            inchikey: 'INCHIKEY-NACN',
            children: [
                { smiles: 'NaCl', inchikey: 'INCHIKEY-NACL' },
                { smiles: 'HCN', inchikey: 'INCHIKEY-HCN' },
            ],
        },
    ],
}
