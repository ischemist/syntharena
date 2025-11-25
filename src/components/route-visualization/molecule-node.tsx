'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'

import type { RouteGraphNode } from '@/types'
import { SmileDrawerSvg } from '@/components/smile-drawer'

/**
 * Custom React Flow node for displaying molecules in a route.
 * Shows SMILES structure via SmilesDrawer and stock availability badge.
 */
export function MoleculeNode({ data }: NodeProps<Node<RouteGraphNode>>) {
    const { smiles, status } = data

    // Status-based styling
    const borderStyles = {
        'in-stock': 'border-emerald-500 border-2',
        default: 'border-gray-300 border-2',
    }

    return (
        <div className={`rounded-lg bg-white shadow-md ${borderStyles[status]}`}>
            <Handle type="target" position={Position.Top} className="!bg-gray-400" />

            {/* Molecule visualization */}
            <div className="flex justify-center">
                <SmileDrawerSvg smilesStr={smiles} width={160} height={120} compactDrawing={false} />
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
        </div>
    )
}
