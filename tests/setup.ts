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
    await prisma.$transaction([
        prisma.routeNode.deleteMany(),
        prisma.predictionRoute.deleteMany(),
        prisma.route.deleteMany(),
        prisma.benchmarkTarget.deleteMany(),
        prisma.predictionRun.deleteMany(),
        prisma.stockItem.deleteMany(),
        prisma.stock.deleteMany(),
        prisma.benchmarkSet.deleteMany(),
        prisma.modelInstance.deleteMany(),
        prisma.algorithm.deleteMany(),
        prisma.molecule.deleteMany(),
        prisma.user.deleteMany(),
    ])
})

afterAll(async () => {
    // Disconnect from the test database
    await prisma.$disconnect()
})
