import { afterAll, afterEach, beforeEach } from 'vitest'

import prisma from '@/lib/db'

/**
 * Test setup file that handles per-test database cleanup
 * Global database setup is handled in global-setup.ts
 */

beforeEach(async () => {
    // Optional: Add any per-test setup here
})

afterEach(async () => {
    // Clean up all data between tests to ensure isolation
    // Delete in correct dependency order to avoid foreign key constraints
    // (leaf tables first, then tables they reference)
    await prisma.$transaction([
        // Layer 5: Deepest leaves (no dependents)
        prisma.stratifiedMetricGroup.deleteMany(),
        prisma.routeSolvability.deleteMany(),
        prisma.routeNode.deleteMany(),
        // Layer 4: Depend on layer 5
        prisma.modelRunStatistics.deleteMany(),
        prisma.predictionRoute.deleteMany(),
        prisma.acceptableRoute.deleteMany(),
        // Layer 3: Depend on layer 4
        prisma.route.deleteMany(),
        prisma.benchmarkTarget.deleteMany(),
        prisma.predictionRun.deleteMany(),
        // Layer 2: Depend on layer 3
        prisma.benchmarkSet.deleteMany(),
        prisma.stockItem.deleteMany(),
        prisma.modelInstance.deleteMany(),
        // Layer 1: Depend on layer 2
        prisma.modelFamily.deleteMany(),
        prisma.stock.deleteMany(),
        prisma.algorithm.deleteMany(),
        prisma.molecule.deleteMany(),
        // Layer 0: No dependencies
        prisma.user.deleteMany(),
    ])
})

afterAll(async () => {
    // Disconnect from the test database
    await prisma.$disconnect()
})
