import { describe, expect, it } from 'vitest'

import {
    HORIZONTAL_SPACING,
    LAYOUT_CONFIG,
    NODE_HEIGHT,
    NODE_WIDTH,
    VERTICAL_SPACING,
} from '@/lib/route-visualization/constants'

describe('Layout Constants', () => {
    describe('Individual constants', () => {
        it('should have positive node dimensions', () => {
            expect(NODE_WIDTH).toBeGreaterThan(0)
            expect(NODE_HEIGHT).toBeGreaterThan(0)
        })

        it('should have non-negative spacing values', () => {
            expect(HORIZONTAL_SPACING).toBeGreaterThanOrEqual(0)
            expect(VERTICAL_SPACING).toBeGreaterThanOrEqual(0)
        })

        it('should have reasonable values for visualization', () => {
            // Node width should be larger than height (typical for molecule cards)
            expect(NODE_WIDTH).toBeGreaterThan(NODE_HEIGHT)

            // Spacing should be smaller than node dimensions
            expect(HORIZONTAL_SPACING).toBeLessThan(NODE_WIDTH)
            expect(VERTICAL_SPACING).toBeLessThan(NODE_HEIGHT * 2)
        })
    })

    describe('LAYOUT_CONFIG', () => {
        it('should match individual constant values', () => {
            expect(LAYOUT_CONFIG.nodeWidth).toBe(NODE_WIDTH)
            expect(LAYOUT_CONFIG.nodeHeight).toBe(NODE_HEIGHT)
            expect(LAYOUT_CONFIG.horizontalSpacing).toBe(HORIZONTAL_SPACING)
            expect(LAYOUT_CONFIG.verticalSpacing).toBe(VERTICAL_SPACING)
        })

        it('should be frozen (readonly)', () => {
            expect(Object.isFrozen(LAYOUT_CONFIG)).toBe(true)
        })

        it('should contain all required properties', () => {
            expect(LAYOUT_CONFIG).toHaveProperty('nodeWidth')
            expect(LAYOUT_CONFIG).toHaveProperty('nodeHeight')
            expect(LAYOUT_CONFIG).toHaveProperty('horizontalSpacing')
            expect(LAYOUT_CONFIG).toHaveProperty('verticalSpacing')
        })
    })
})
