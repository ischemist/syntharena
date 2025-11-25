'use client'

import { useMemo } from 'react'
import { Background, Controls, ReactFlow, useEdgesState, useNodesState } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'

import type { RouteGraphNode, RouteVisualizationNode } from '@/types'
import { buildRouteGraph } from '@/lib/route-visualization'

import { MoleculeNode } from './molecule-node'

import '@xyflow/react/dist/style.css'

const nodeTypes = {
    molecule: MoleculeNode,
}

interface RouteGraphProps {
    route: RouteVisualizationNode
    inStockSmiles: Set<string>
    idPrefix?: string
}

/**
 * Main route visualization component using React Flow.
 * Renders an interactive tree of molecules with stock availability.
 *
 * Phase 1 features:
 * - Single route display
 * - Stock availability highlighting
 * - Pan and zoom controls
 * - Responsive layout
 */
export function RouteGraph({ route, inStockSmiles, idPrefix = 'route-' }: RouteGraphProps) {
    // Memoize graph building to avoid unnecessary recalculations
    const { initialNodes, initialEdges } = useMemo(() => {
        const { nodes, edges } = buildRouteGraph(route, inStockSmiles, idPrefix)
        return {
            initialNodes: nodes as Node<RouteGraphNode>[],
            initialEdges: edges as Edge[],
        }
    }, [route, inStockSmiles, idPrefix])

    const [nodes, , onNodesChange] = useNodesState(initialNodes)
    const [edges, , onEdgesChange] = useEdgesState(initialEdges)

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
                <Background color="#e5e7eb" gap={16} />
                <Controls showInteractive={false} />
            </ReactFlow>
        </div>
    )
}
