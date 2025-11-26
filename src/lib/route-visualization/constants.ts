/**
 * Layout configuration constants for route tree visualization.
 * These values control spacing and node dimensions.
 */

// Node dimensions (in pixels)
export const NODE_WIDTH = 150
export const NODE_HEIGHT = 60

// Spacing between nodes (in pixels)
export const HORIZONTAL_SPACING = 30
export const VERTICAL_SPACING = 160

// Export as config object for flexibility
export const LAYOUT_CONFIG = Object.freeze({
    nodeWidth: NODE_WIDTH,
    nodeHeight: NODE_HEIGHT,
    horizontalSpacing: HORIZONTAL_SPACING,
    verticalSpacing: VERTICAL_SPACING,
}) satisfies Record<string, number>
