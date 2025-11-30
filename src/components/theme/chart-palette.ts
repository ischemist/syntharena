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
    Solvability: { bar: 'hsl(261, 100%, 79%)', errorBar: 'hsl(220 70% 25%)' },
    'Top-1': { bar: '#ffccd5', errorBar: '#ffb3c1' },
    'Top-2': { bar: '#', errorBar: '#' },
    'Top-3': { bar: '#', errorBar: '#' },
    'Top-4': { bar: '#', errorBar: '#' },
    'Top-5': { bar: '#', errorBar: '#' },
    'Top-10': { bar: '#', errorBar: '#' },
    'Top-20': { bar: '#', errorBar: '#' },
    'Top-50': { bar: '#', errorBar: '#' },
    'Top-100': { bar: '#', errorBar: '#' },
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
