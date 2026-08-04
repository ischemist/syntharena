/**
 * Shared helper for upserting ReactionStep records during route loading.
 * Used by both the prediction loader and benchmark loader.
 */
import { Prisma } from '@prisma/client'
import { createId } from '@paralleldrive/cuid2'

import type prisma from '@/lib/db'

/** Minimal DB client interface — works with both PrismaClient and TransactionClient. */
type DbClient = typeof prisma | Prisma.TransactionClient
const SQLITE_BATCH_SIZE = 200

function chunks<T>(values: T[]): T[][] {
    const result: T[][] = []
    for (let index = 0; index < values.length; index += SQLITE_BATCH_SIZE) {
        result.push(values.slice(index, index + SQLITE_BATCH_SIZE))
    }
    return result
}

/** Shape of a node that carries reaction data for ReactionStep upsert. */
interface NodeWithReactionData {
    reactionHash: string | null
    template: string | null
    metadata: string | null
}

/**
 * Upserts ReactionStep records for a batch of route nodes.
 * Finds existing steps by reactionHash and creates missing ones.
 *
 * @returns Map from reactionHash to ReactionStep.id
 */
export async function upsertReactionSteps(nodes: NodeWithReactionData[], db: DbClient): Promise<Map<string, string>> {
    // Collect unique reactions by reactionHash
    const reactionHashesSet = new Set<string>()
    for (const node of nodes) {
        if (node.reactionHash) reactionHashesSet.add(node.reactionHash)
    }

    const reactionHashToId = new Map<string, string>()
    const reactionHashes = Array.from(reactionHashesSet)

    if (reactionHashes.length === 0) return reactionHashToId

    // Find existing ReactionStep records
    for (const batch of chunks(reactionHashes)) {
        const existingSteps = await db.reactionStep.findMany({
            where: { reactionHash: { in: batch } },
            select: { id: true, reactionHash: true },
        })
        for (const step of existingSteps) reactionHashToId.set(step.reactionHash, step.id)
    }

    const missingReactions = reactionHashes.filter((hash) => !reactionHashToId.has(hash))

    if (missingReactions.length > 0) {
        for (const batch of chunks(missingReactions)) {
            const records = batch.map((reactionHash) => {
                const id = createId()
                reactionHashToId.set(reactionHash, id)
                return { id, reactionHash }
            })
            await db.reactionStep.createMany({ data: records })
        }
    }

    return reactionHashToId
}
