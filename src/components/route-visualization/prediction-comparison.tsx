'use client'

import { useMemo } from 'react'
import { Background, Controls, ReactFlow, useEdgesState, useNodesState } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'
import { useTheme } from 'next-themes'

import type { RouteGraphNode, RouteVisualizationNode } from '@/types'
import {
    buildPredictionDiffOverlayGraph,
    buildPredictionSideBySideGraph,
    collectInchiKeys,
} from '@/lib/route-visualization'

import { MoleculeNode } from './molecule-node'

import '@xyflow/react/dist/style.css'

const nodeTypes = {
    molecule: MoleculeNode,
}

interface PredictionComparisonProps {
    prediction1Route: RouteVisualizationNode
    prediction2Route: RouteVisualizationNode
    mode: 'side-by-side' | 'diff-overlay'
    inStockInchiKeys: Set<string>
    model1Label?: string
    model2Label?: string
}

/**
 * Single graph panel for displaying one prediction route tree.
 * Used in side-by-side comparison mode for pred-vs-pred.
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
 * Diff overlay panel for displaying merged prediction comparison.
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
 * Prediction-vs-prediction comparison component.
 * Shows the difference between two model predictions with both treated equally.
 * Both predictions show stock availability badges on leaf nodes.
 */
export function PredictionComparison({
    prediction1Route,
    prediction2Route,
    mode,
    inStockInchiKeys,
    model1Label = 'Model 1 Prediction',
    model2Label = 'Model 2 Prediction',
}: PredictionComparisonProps) {
    // Collect InChiKeys from both routes for comparison
    const pred1InchiKeys = useMemo(() => {
        const set = new Set<string>()
        collectInchiKeys(prediction1Route, set)
        return set
    }, [prediction1Route])

    const pred2InchiKeys = useMemo(() => {
        const set = new Set<string>()
        collectInchiKeys(prediction2Route, set)
        return set
    }, [prediction2Route])

    // Build graphs based on mode
    const { pred1Graph, pred2Graph, diffGraph } = useMemo(() => {
        if (mode === 'side-by-side') {
            return {
                pred1Graph: buildPredictionSideBySideGraph(
                    prediction1Route,
                    prediction2Route,
                    pred1InchiKeys,
                    pred2InchiKeys,
                    true,
                    'pred1_',
                    inStockInchiKeys
                ),
                pred2Graph: buildPredictionSideBySideGraph(
                    prediction2Route,
                    prediction1Route,
                    pred1InchiKeys,
                    pred2InchiKeys,
                    false,
                    'pred2_',
                    inStockInchiKeys
                ),
                diffGraph: null,
            }
        } else {
            return {
                pred1Graph: null,
                pred2Graph: null,
                diffGraph: buildPredictionDiffOverlayGraph(prediction1Route, prediction2Route, inStockInchiKeys),
            }
        }
    }, [prediction1Route, prediction2Route, pred1InchiKeys, pred2InchiKeys, mode, inStockInchiKeys])

    if (mode === 'side-by-side' && pred1Graph && pred2Graph) {
        return (
            <div className="divide-border grid h-full grid-cols-2 divide-x">
                <GraphPanel nodes={pred1Graph.nodes} edges={pred1Graph.edges} title={model1Label} />
                <GraphPanel nodes={pred2Graph.nodes} edges={pred2Graph.edges} title={model2Label} />
            </div>
        )
    }

    if (mode === 'diff-overlay' && diffGraph) {
        return <DiffOverlayPanel nodes={diffGraph.nodes} edges={diffGraph.edges} />
    }

    return null
}
