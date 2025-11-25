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

    const badgeStyles = {
        'in-stock': 'bg-emerald-500 text-white',
        default: 'bg-gray-100 text-gray-700',
    }

    const badgeLabels = {
        'in-stock': 'In Stock',
        default: 'Not in Stock',
    }

    return (
        <div className={`rounded-lg bg-white shadow-md ${borderStyles[status]} p-2`}>
            <Handle type="target" position={Position.Top} className="!bg-gray-400" />

            {/* Molecule visualization */}
            <div className="flex justify-center py-1">
                <SmileDrawerSvg smilesStr={smiles} width={120} height={80} compactDrawing={true} />
            </div>

            {/* Status badge */}
            <div className={`mt-1 rounded-full px-2 py-1 text-center text-xs font-medium ${badgeStyles[status]}`}>
                {badgeLabels[status]}
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
        </div>
    )
}
