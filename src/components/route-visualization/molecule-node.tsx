'use client'

import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import { CheckCircle2, Ghost, XCircle } from 'lucide-react'

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
 * - "hallucination": Only in prediction, not in GT (red border, solid)
 * - "ghost": Only in GT, missing from prediction (gray border, dashed)
 */
export function MoleculeNode({ data }: NodeProps<Node<RouteGraphNode>>) {
    const { smiles, status } = data

    // Status-based styling
    const statusClasses: Record<NodeStatus, string> = {
        'in-stock': 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950',
        default: 'border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900',
        match: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950',
        hallucination: 'border-red-500 bg-red-50 dark:bg-red-950',
        ghost: 'border-gray-400 border-dashed bg-gray-100 dark:bg-gray-800 opacity-60',
    }

    // Status icons for comparison modes
    const statusIcons: Partial<Record<NodeStatus, React.ReactNode>> = {
        match: <CheckCircle2 className="h-3 w-3 text-emerald-500" />,
        hallucination: <XCircle className="h-3 w-3 text-red-500" />,
        ghost: <Ghost className="h-3 w-3 text-gray-400" />,
    }

    // Status labels for comparison modes
    const statusLabels: Partial<Record<NodeStatus, string>> = {
        match: 'Match',
        hallucination: 'Hallucination',
        ghost: 'Missing',
    }

    const nodeClass = statusClasses[status] || statusClasses.default
    const showStatusBadge = status === 'match' || status === 'hallucination' || status === 'ghost'

    return (
        <div className={`relative rounded-lg border-2 shadow-sm ${nodeClass}`}>
            <Handle type="target" position={Position.Top} className="!bg-gray-400 dark:!bg-gray-600" />

            {/* Molecule visualization */}
            <div className="flex flex-col items-center p-2">
                <SmileDrawerSvg smilesStr={smiles} width={160} height={120} compactDrawing={false} />

                {/* Status badge for comparison modes */}
                {showStatusBadge && (
                    <div className="bg-background mt-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                        {statusIcons[status]}
                        <span>{statusLabels[status]}</span>
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-gray-400 dark:!bg-gray-600" />
        </div>
    )
}
