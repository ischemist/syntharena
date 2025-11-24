'use client'

import React, { useEffect, useMemo, useRef } from 'react'
import { useTheme } from 'next-themes'
// @ts-expect-error - no types available for smiles-drawer
import SmilesDrawer from 'smiles-drawer'

export const SmileDrawerSvg = ({
    smilesStr,
    width = 300,
    height = 300,
    compactDrawing = true,
    scale = 1.0,
}: {
    smilesStr: string
    width?: number
    height?: number
    compactDrawing?: boolean
    scale?: number
}) => {
    const SETTINGS = useMemo(
        () => ({
            width,
            height,
            compactDrawing,
            bondThickness: 2.0,
            padding: 2,
        }),
        [width, height, compactDrawing]
    )

    const svgRef = useRef(null)
    const { resolvedTheme } = useTheme()

    useEffect(() => {
        const svgDrawer = new SmilesDrawer.SmiDrawer(SETTINGS, { scale })
        svgDrawer.draw(smilesStr, svgRef.current, resolvedTheme, false)
    }, [smilesStr, resolvedTheme, SETTINGS, scale])

    return <svg ref={svgRef} width={width} height={height}></svg>
}
