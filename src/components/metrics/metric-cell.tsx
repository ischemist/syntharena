'use client'

import { useState } from 'react'

import type { MetricResult } from '@/types'
import { ReliabilityBadge } from '@/components/badges/reliability'

type MetricCellProps = {
    metric: MetricResult
    showBadge?: boolean
}

/**
 * Interactive metric cell that shows confidence intervals on hover.
 * Default: Shows just the value (e.g., "45.2%")
 * On hover: Shows CI in blue on either side (e.g., "42.1 [45.2%] 48.3")
 *
 * Layout strategy:
 * - The outer span is inline so the cell centers based on value width only
 * - Badge is positioned absolutely to the right, outside the value's layout flow
 * - CIs are positioned absolutely relative to the value
 */
export function MetricCell({ metric, showBadge = false }: MetricCellProps) {
    const [isHovered, setIsHovered] = useState(false)

    const valuePercent = (metric.value * 100).toFixed(1)
    const lowerPercent = (metric.ciLower * 100).toFixed(1)
    const upperPercent = (metric.ciUpper * 100).toFixed(1)

    return (
        <span
            className="relative inline-block font-mono"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Lower CI - positioned to the left of value, rises from below */}
            {isHovered && (
                <span className="animate-in fade-in slide-in-from-bottom-1 absolute right-full mr-2 text-blue-500 duration-200">
                    {lowerPercent}
                </span>
            )}
            {/* Main value - this is the alignment anchor */}
            {valuePercent}%{/* Upper CI - positioned to the right of value, rises from below */}
            {isHovered && (
                <span className="animate-in fade-in slide-in-from-bottom-1 absolute left-full ml-2 text-blue-500 duration-200">
                    {upperPercent}
                </span>
            )}
            {/* Reliability badge - positioned after upper CI, outside layout flow */}
            {showBadge && (
                <span className="absolute left-full ml-2 inline-flex items-center transition-transform duration-200">
                    {isHovered && (
                        // Spacer to push badge past the upper CI when visible
                        <span className="invisible">{upperPercent}</span>
                    )}
                    <span className={isHovered ? 'ml-2' : ''}>
                        <ReliabilityBadge reliability={metric.reliability} size="sm" />
                    </span>
                </span>
            )}
        </span>
    )
}
