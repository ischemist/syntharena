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
        prisma.candidateTierResult.deleteMany(),
        prisma.candidateEvaluation.deleteMany(),
        prisma.metricEstimate.deleteMany(),
        prisma.targetEvaluation.deleteMany(),
        prisma.runEvaluation.deleteMany(),
        prisma.predictionCandidate.deleteMany(),
        prisma.routeNode.deleteMany(),
        prisma.acceptableRoute.deleteMany(),
        prisma.route.deleteMany(),
        prisma.benchmarkTarget.deleteMany(),
        prisma.predictionRun.deleteMany(),
        prisma.benchmarkSet.deleteMany(),
        prisma.stockItem.deleteMany(),
        prisma.modelInstance.deleteMany(),
        prisma.modelFamily.deleteMany(),
        prisma.stock.deleteMany(),
        prisma.algorithm.deleteMany(),
        prisma.reactionStep.deleteMany(),
        prisma.molecule.deleteMany(),
        prisma.databaseMetadata.deleteMany(),
        prisma.user.deleteMany(),
    ])
})

afterAll(async () => {
    // Disconnect from the test database
    await prisma.$disconnect()
})
