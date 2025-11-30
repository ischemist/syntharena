/**
 * Centralized chart color palette for consistent styling across all charts.
 * Update these values to change chart colors application-wide.
 */

// Primary blue color scheme for bar charts
export const chartColors = {
    // Primary bar colors (use for main data series)
    primary: 'hsl(261, 100%, 79%)',
    primaryDark: 'hsl(220 70% 35%)', // For error bars on primary

    // Color palette for grouped/multi-series charts
    series: [
        'hsl(261, 100%, 79%)', // Primary blue
        'hsl(200 70% 50%)', // Cyan blue
        'hsl(240 70% 55%)', // Purple blue
        'hsl(180 60% 45%)', // Teal
        'hsl(280 60% 55%)', // Purple
    ],

    // Corresponding darker shades for error bars (ensure contrast)
    seriesErrorBars: [
        'hsl(220 70% 25%)', // Dark primary blue
        'hsl(200 70% 25%)', // Dark cyan blue
        'hsl(240 70% 30%)', // Dark purple blue
        'hsl(180 60% 25%)', // Dark teal
        'hsl(280 60% 30%)', // Dark purple
    ],

    // Status-based colors
    reliable: 'hsl(220 70% 50%)', // Blue for reliable metrics
    unreliable: 'hsl(25 95% 53%)', // Orange for unreliable metrics
} as const

/**
 * Semantic color mapping for specific metrics.
 * Ensures consistent colors across all chart types.
 */
export const metricColors = {
    Solvability: { bar: '#c77dff', errorBar: '#9d4edd' },
    'Top-1': { bar: '#ffccd5', errorBar: '#ffb3c1' },
    'Top-2': { bar: '#ffb3c1', errorBar: '#ff8fa3' },
    'Top-3': { bar: '#ff8fa3', errorBar: '#ff758f' },
    'Top-4': { bar: '#ff758f', errorBar: '#ff4d6d' },
    'Top-5': { bar: '#ff4d6d', errorBar: '#c9184a' },
    'Top-10': { bar: '#c9184a', errorBar: '#a4133c' },
    'Top-20': { bar: '#a4133c', errorBar: '#800f2f' },
    'Top-50': { bar: '#800f2f', errorBar: '#590d22' },
    'Top-100': { bar: '#590d22', errorBar: '#461220' },
} as const

/**
 * Get bar color and corresponding error bar color for a series index
 */
export function getSeriesColors(index: number): { bar: string; errorBar: string } {
    const seriesIndex = index % chartColors.series.length
    return {
        bar: chartColors.series[seriesIndex],
        errorBar: chartColors.seriesErrorBars[seriesIndex],
    }
}

/**
 * Get colors for a specific metric by name, with fallback to series colors.
 * This ensures consistent colors across all chart types while supporting unknown metrics.
 */
export function getMetricColors(metricName: string, fallbackIndex: number): { bar: string; errorBar: string } {
    return metricColors[metricName as keyof typeof metricColors] ?? getSeriesColors(fallbackIndex)
}
