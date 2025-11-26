'use client'

import { useMemo } from 'react'
import { Background, Controls, ReactFlow, useEdgesState, useNodesState } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'
import { useTheme } from 'next-themes'

import type { RouteGraphNode, RouteVisualizationNode } from '@/types'
import { buildRouteGraph } from '@/lib/route-visualization'

import { MoleculeNode } from './molecule-node'

import '@xyflow/react/dist/style.css'

const nodeTypes = {
    molecule: MoleculeNode,
}

interface RouteGraphProps {
    route: RouteVisualizationNode
    inStockInchiKeys: Set<string>
    idPrefix?: string
}

/**
 * Main route visualization component using React Flow.
 * Renders an interactive tree of molecules with stock availability.
 * Uses InChiKeys for reliable molecule comparison.
 *
 * Phase 1 features:
 * - Single route display
 * - Stock availability highlighting (InChiKey-based)
 * - Pan and zoom controls
 * - Responsive layout
 */
export function RouteGraph({ route, inStockInchiKeys, idPrefix = 'route-' }: RouteGraphProps) {
    const { theme } = useTheme()

    // Memoize graph building to avoid unnecessary recalculations
    const { initialNodes, initialEdges } = useMemo(() => {
        const { nodes, edges } = buildRouteGraph(route, inStockInchiKeys, idPrefix)
        return {
            initialNodes: nodes as Node<RouteGraphNode>[],
            initialEdges: edges as Edge[],
        }
    }, [route, inStockInchiKeys, idPrefix])

    const [nodes, , onNodesChange] = useNodesState(initialNodes)
    const [edges, , onEdgesChange] = useEdgesState(initialEdges)

    // Dynamic background color based on theme
    const backgroundColor = theme === 'dark' ? '#374151' : '#e5e7eb'

    return (
        <div className="h-full w-full">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2, minZoom: 0.1, maxZoom: 4 }}
                nodesDraggable={true}
                nodesConnectable={false}
                elementsSelectable={false}
            >
                <Background color={backgroundColor} gap={16} />
                <Controls showInteractive={false} />
            </ReactFlow>
        </div>
    )
}
