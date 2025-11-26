'use client'

import { useState } from 'react'

import type { MetricResult } from '@/types'

type MetricCellProps = {
    metric: MetricResult
}

/**
 * Interactive metric cell that shows confidence intervals on hover.
 * Default: Shows just the value (e.g., "45.2%")
 * On hover: Shows CI in blue on either side (e.g., "42.1 45.2% 48.3")
 * Uses relative positioning to prevent layout shifts.
 */
export function MetricCell({ metric }: MetricCellProps) {
    const [isHovered, setIsHovered] = useState(false)

    const valuePercent = (metric.value * 100).toFixed(1)
    const lowerPercent = (metric.ciLower * 100).toFixed(1)
    const upperPercent = (metric.ciUpper * 100).toFixed(1)

    return (
        <div
            className="relative inline-flex items-center justify-center font-mono"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Lower CI - positioned to the left */}
            {isHovered && (
                <span className="animate-in fade-in absolute right-full mr-2 text-blue-500 transition-opacity duration-200">
                    {lowerPercent}
                </span>
            )}

            {/* Main value - stays in place */}
            <span>{valuePercent}%</span>

            {/* Upper CI - positioned to the right */}
            {isHovered && (
                <span className="animate-in fade-in absolute left-full ml-2 text-blue-500 transition-opacity duration-200">
                    {upperPercent}
                </span>
            )}
        </div>
    )
}
