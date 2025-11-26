/**
 * Centralized chart color palette for consistent styling across all charts.
 * Update these values to change chart colors application-wide.
 */

// Primary blue color scheme for bar charts
export const chartColors = {
    // Primary bar colors (use for main data series)
    primary: 'hsl(220 70% 50%)',
    primaryDark: 'hsl(220 70% 35%)', // For error bars on primary

    // Color palette for grouped/multi-series charts
    series: [
        'hsl(220 70% 50%)', // Primary blue
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
 * Get bar color and corresponding error bar color for a series index
 */
export function getSeriesColors(index: number): { bar: string; errorBar: string } {
    const seriesIndex = index % chartColors.series.length
    return {
        bar: chartColors.series[seriesIndex],
        errorBar: chartColors.seriesErrorBars[seriesIndex],
    }
}
