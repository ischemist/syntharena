'use client'

import { useMemo } from 'react'
import { FlowPanel } from '@ischemist/route-viewer'
import type { Edge, Node } from '@xyflow/react'

import type { BuyableMetadata, RouteGraphNode, RouteVisualizationNode } from '@/types'
import { buildRouteGraph } from '@/lib/route-visualization'

interface RouteGraphProps {
    route?: RouteVisualizationNode
    inStockInchiKeys: Set<string>
    buyableMetadataMap?: Map<string, BuyableMetadata>
    idPrefix?: string
    preCalculatedNodes?: Array<{ id: string; smiles: string; inchikey: string; x: number; y: number }>
    preCalculatedEdges?: Array<{ source: string; target: string }>
}

export function RouteGraph({
    route,
    inStockInchiKeys,
    buyableMetadataMap,
    idPrefix = 'route-',
    preCalculatedNodes,
    preCalculatedEdges,
}: RouteGraphProps) {
    const { nodes, edges } = useMemo(() => {
        if (preCalculatedNodes && preCalculatedEdges) {
            return {
                nodes: preCalculatedNodes.map((node) => {
                    const inStock = inStockInchiKeys.has(node.inchikey)
                    const metadata = buyableMetadataMap?.get(node.inchikey)

                    return {
                        id: node.id,
                        type: 'molecule',
                        position: { x: node.x, y: node.y },
                        data: {
                            smiles: node.smiles,
                            inchikey: node.inchikey,
                            status: 'default',
                            inStock,
                            ppg: metadata?.ppg,
                            source: metadata?.source,
                            leadTime: metadata?.leadTime,
                            link: metadata?.link,
                        },
                    }
                }) as Node<RouteGraphNode>[],
                edges: preCalculatedEdges.map((edge, index) => ({
                    id: `${idPrefix}edge-${index}`,
                    source: edge.source,
                    target: edge.target,
                    animated: false,
                    style: { stroke: '#94a3b8', strokeWidth: 2 },
                })) as Edge[],
            }
        }

        if (!route) {
            throw new Error('RouteGraph requires either route or preCalculatedNodes/preCalculatedEdges')
        }

        return buildRouteGraph(route, inStockInchiKeys, idPrefix, buyableMetadataMap)
    }, [route, inStockInchiKeys, buyableMetadataMap, idPrefix, preCalculatedNodes, preCalculatedEdges])

    return <FlowPanel nodes={nodes} edges={edges} />
}
