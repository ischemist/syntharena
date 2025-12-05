'use client'

import { useMemo } from 'react'
import { Background, Controls, ReactFlow, useEdgesState, useNodesState } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'
import { useTheme } from 'next-themes'

import type { RouteGraphNode, RouteVisualizationNode, VendorSource } from '@/types'
import { buildRouteGraph } from '@/lib/route-visualization'

import { MoleculeNode } from './molecule-node'

import '@xyflow/react/dist/style.css'

const nodeTypes = {
    molecule: MoleculeNode,
}

type BuyableMetadata = {
    ppg: number | null
    source: VendorSource | null
    leadTime: string | null
    link: string | null
}

interface RouteGraphProps {
    route?: RouteVisualizationNode
    inStockInchiKeys: Set<string>
    buyableMetadataMap?: Map<string, BuyableMetadata>
    idPrefix?: string
    // Pre-calculated layout from server (Phase 3 optimization)
    preCalculatedNodes?: Array<{ id: string; smiles: string; inchikey: string; x: number; y: number }>
    preCalculatedEdges?: Array<{ source: string; target: string }>
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
 *
 * Phase 3 optimization:
 * - Accepts pre-calculated layout from server to skip client-side positioning
 * - Falls back to client-side layout if not provided (backward compatibility)
 */
export function RouteGraph({
    route,
    inStockInchiKeys,
    buyableMetadataMap,
    idPrefix = 'route-',
    preCalculatedNodes,
    preCalculatedEdges,
}: RouteGraphProps) {
    const { theme } = useTheme()

    // Memoize graph building to avoid unnecessary recalculations
    const { initialNodes, initialEdges } = useMemo(() => {
        // Phase 3: Use server-calculated layout if available
        if (preCalculatedNodes && preCalculatedEdges) {
            const nodes: Node<RouteGraphNode>[] = preCalculatedNodes.map((n) => {
                const inStock = inStockInchiKeys.has(n.inchikey)
                const metadata = buyableMetadataMap?.get(n.inchikey)
                return {
                    id: n.id,
                    type: 'molecule',
                    position: { x: n.x, y: n.y },
                    data: {
                        smiles: n.smiles,
                        inchikey: n.inchikey,
                        status: inStock ? 'in-stock' : 'default',
                        inStock,
                        ppg: metadata?.ppg,
                        source: metadata?.source,
                        leadTime: metadata?.leadTime,
                        link: metadata?.link,
                    },
                }
            })

            const edges: Edge[] = preCalculatedEdges.map((e, idx) => ({
                id: `${idPrefix}edge-${idx}`,
                source: e.source,
                target: e.target,
                animated: false,
                style: { stroke: '#94a3b8', strokeWidth: 2 },
            }))

            return { initialNodes: nodes, initialEdges: edges }
        }

        // Fallback: Client-side layout calculation (backward compatibility)
        if (!route) {
            throw new Error('RouteGraph requires either route or preCalculatedNodes/preCalculatedEdges')
        }

        const { nodes, edges } = buildRouteGraph(route, inStockInchiKeys, idPrefix, buyableMetadataMap)
        return {
            initialNodes: nodes as Node<RouteGraphNode>[],
            initialEdges: edges as Edge[],
        }
    }, [route, inStockInchiKeys, buyableMetadataMap, idPrefix, preCalculatedNodes, preCalculatedEdges])

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
