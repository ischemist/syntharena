'use client'

import { useMemo } from 'react'
import { Background, Controls, ReactFlow, useEdgesState, useNodesState } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'
import { useTheme } from 'next-themes'

import type { RouteGraphNode, RouteVisualizationNode } from '@/types'
import { buildDiffOverlayGraph, buildSideBySideGraph, collectInchiKeys } from '@/lib/route-visualization'

import { MoleculeNode } from './molecule-node'

import '@xyflow/react/dist/style.css'

const nodeTypes = {
    molecule: MoleculeNode,
}

interface RouteComparisonProps {
    groundTruthRoute: RouteVisualizationNode
    predictionRoute: RouteVisualizationNode
    mode: 'side-by-side' | 'diff-overlay'
    inStockInchiKeys: Set<string>
    modelName?: string
}

/**
 * Single graph panel for displaying one route tree.
 * Used in side-by-side comparison mode.
 */
function GraphPanel({
    nodes: initialNodes,
    edges: initialEdges,
    title,
}: {
    nodes: Node<RouteGraphNode>[]
    edges: Edge[]
    title?: string
}) {
    const { theme } = useTheme()
    const [nodes, , onNodesChange] = useNodesState(initialNodes)
    const [edges, , onEdgesChange] = useEdgesState(initialEdges)

    const backgroundColor = theme === 'dark' ? '#374151' : '#e5e7eb'

    return (
        <div className="flex h-full flex-col">
            {title && (
                <div className="border-border bg-muted/50 text-foreground border-b px-4 py-2 text-sm font-medium">
                    {title}
                </div>
            )}
            <div className="flex-1">
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
        </div>
    )
}

/**
 * Diff overlay panel for displaying merged route comparison.
 * Separated from main component to avoid hooks ordering issues.
 */
function DiffOverlayPanel({
    nodes: initialNodes,
    edges: initialEdges,
}: {
    nodes: Node<RouteGraphNode>[]
    edges: Edge[]
}) {
    const { theme } = useTheme()
    const [nodes, , onNodesChange] = useNodesState(initialNodes)
    const [edges, , onEdgesChange] = useEdgesState(initialEdges)

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

/**
 * Route comparison component supporting side-by-side and diff overlay views.
 * Shows the difference between ground truth and predicted routes.
 */
export function RouteComparison({
    groundTruthRoute,
    predictionRoute,
    mode,
    inStockInchiKeys,
    modelName,
}: RouteComparisonProps) {
    // Collect InChiKeys from both routes for comparison
    const gtInchiKeys = useMemo(() => {
        const set = new Set<string>()
        collectInchiKeys(groundTruthRoute, set)
        return set
    }, [groundTruthRoute])

    const predInchiKeys = useMemo(() => {
        const set = new Set<string>()
        collectInchiKeys(predictionRoute, set)
        return set
    }, [predictionRoute])

    // Build graphs based on mode
    const { gtGraph, predGraph, diffGraph } = useMemo(() => {
        if (mode === 'side-by-side') {
            return {
                gtGraph: buildSideBySideGraph(
                    groundTruthRoute,
                    predictionRoute,
                    gtInchiKeys,
                    predInchiKeys,
                    true,
                    'gt_',
                    inStockInchiKeys
                ),
                predGraph: buildSideBySideGraph(
                    predictionRoute,
                    groundTruthRoute,
                    gtInchiKeys,
                    predInchiKeys,
                    false,
                    'pred_',
                    inStockInchiKeys
                ),
                diffGraph: null,
            }
        } else {
            return {
                gtGraph: null,
                predGraph: null,
                diffGraph: buildDiffOverlayGraph(groundTruthRoute, predictionRoute, inStockInchiKeys),
            }
        }
    }, [groundTruthRoute, predictionRoute, gtInchiKeys, predInchiKeys, mode, inStockInchiKeys])

    if (mode === 'side-by-side' && gtGraph && predGraph) {
        return (
            <div className="divide-border grid h-full grid-cols-2 divide-x">
                <GraphPanel nodes={gtGraph.nodes} edges={gtGraph.edges} title="Ground Truth" />
                <GraphPanel nodes={predGraph.nodes} edges={predGraph.edges} title={modelName || 'Prediction'} />
            </div>
        )
    }

    if (mode === 'diff-overlay' && diffGraph) {
        return <DiffOverlayPanel nodes={diffGraph.nodes} edges={diffGraph.edges} />
    }

    return null
}
