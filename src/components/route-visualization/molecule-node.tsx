'use client'

import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import { Package } from 'lucide-react'

import type { NodeStatus, RouteGraphNode } from '@/types'
import { SmileDrawerSvg } from '@/components/smile-drawer'

/**
 * Custom React Flow node for displaying molecules in routes.
 * Shows molecule structure with status-based styling.
 *
 * Supported statuses:
 * - "in-stock": Molecule is available in the selected stock (green border)
 * - "default": Normal molecule node (gray border)
 * - "match": Both GT and prediction have this molecule (green border, solid)
 * - "extension": Only in prediction, not in GT (amber/yellow border, solid) - potential alternative route
 * - "ghost": Only in GT, missing from prediction (gray border, dashed)
 */
export function MoleculeNode({ data }: NodeProps<Node<RouteGraphNode>>) {
    const { smiles, status, isLeaf, inStock } = data

    // Status-based styling - borders only, no background fills
    const statusClasses: Record<NodeStatus, string> = {
        'in-stock': 'border-emerald-500 bg-white dark:bg-gray-900',
        default: 'border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900',
        match: 'border-emerald-500 bg-white dark:bg-gray-900',
        extension: 'border-amber-500 bg-white dark:bg-gray-900',
        ghost: 'border-gray-400 border-dashed bg-white dark:bg-gray-900 opacity-60',
        'pred-shared': 'border-teal-500 bg-white dark:bg-gray-900',
        'pred-1-only': 'border-sky-500 bg-white dark:bg-gray-900',
        'pred-2-only': 'border-violet-500 bg-white dark:bg-gray-900',
    }

    const nodeClass = statusClasses[status] || statusClasses.default

    // Show stock badge for leaf nodes in comparison mode
    // GT vs pred: extension or match
    // Pred vs pred: any pred-* status
    const showStockBadge =
        isLeaf &&
        (status === 'extension' ||
            status === 'match' ||
            status === 'pred-shared' ||
            status === 'pred-1-only' ||
            status === 'pred-2-only')

    return (
        <div className={`relative rounded-lg border-2 shadow-sm ${nodeClass}`}>
            <Handle type="target" position={Position.Top} className="!bg-gray-400 dark:!bg-gray-600" />

            {/* Molecule visualization */}
            <div className="flex flex-col items-center p-2">
                <SmileDrawerSvg smilesStr={smiles} width={160} height={120} compactDrawing={false} />

                {/* Stock availability badge for leaf nodes in comparison mode */}
                {showStockBadge && (
                    <span
                        className={
                            inStock
                                ? 'mt-1 inline-flex items-center gap-1 rounded-md border-transparent bg-emerald-500/15 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300'
                                : 'mt-1 inline-flex items-center gap-1 rounded-md border-transparent bg-gray-500/15 px-1.5 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300'
                        }
                    >
                        <Package className="h-3 w-3" />
                        {inStock ? 'In Stock' : 'Not in Stock'}
                    </span>
                )}
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-gray-400 dark:!bg-gray-600" />
        </div>
    )
}
