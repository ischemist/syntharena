#!/usr/bin/env tsx
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@prisma/client'

import '../env-loader'

const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL,
})
const prisma = new PrismaClient({ adapter })

/**
 * Generates a URL-friendly slug from a model name.
 * e.g., "AiZynthFinder Retro* (High)" -> "aizynthfinder-retro-star-high"
 */
function createSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/\*/g, 'star') // Replace '*' with 'star'
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/[()]/g, '') // Remove parentheses
        .replace(/[^a-z0-9-]/g, '') // Remove any remaining invalid chars
}

async function migrateData() {
    console.log('Starting model family data migration...')

    await prisma.$transaction(async (tx) => {
        // 1. Find all instances to determine the unique families needed.
        const instances = await tx.modelInstance.findMany({
            select: { id: true, name: true, algorithmId: true },
        })

        if (instances.length === 0) {
            console.log('No model instances found. Nothing to migrate.')
            return
        }

        // 2. Identify unique families using a Map to prevent duplicates.
        const familyMap = new Map<string, { name: string; algorithmId: string }>()
        for (const instance of instances) {
            const key = `${instance.algorithmId}::${instance.name}`
            if (!familyMap.has(key)) {
                familyMap.set(key, { name: instance.name, algorithmId: instance.algorithmId })
            }
        }

        console.log(`Found ${familyMap.size} unique model families to create.`)

        // 3. Create a ModelFamily for each unique entry. Prisma handles CUIDs.
        const createdFamilies = new Map<string, { id: string }>()
        for (const [key, familyData] of familyMap.entries()) {
            const newFamily = await tx.modelFamily.create({
                data: {
                    name: familyData.name,
                    slug: createSlug(familyData.name),
                    algorithmId: familyData.algorithmId,
                },
                select: { id: true },
            })
            createdFamilies.set(key, { id: newFamily.id })
            console.log(`  - Created family "${familyData.name}" (ID: ${newFamily.id})`)
        }

        console.log('All families created. Linking instances...')

        // 4. Link each ModelInstance to its newly created parent family.
        for (const instance of instances) {
            const key = `${instance.algorithmId}::${instance.name}`
            const family = createdFamilies.get(key)

            if (!family) {
                // This should never happen, but it's a good safeguard.
                throw new Error(`Could not find a created family for instance ${instance.id} (${instance.name})`)
            }

            await tx.modelInstance.update({
                where: { id: instance.id },
                data: { modelFamilyId: family.id },
            })
        }

        console.log(`${instances.length} model instances linked successfully.`)
    })

    console.log('Migration complete.')
}

async function main() {
    try {
        await migrateData()
        process.exit(0)
    } catch (error) {
        console.error('Error during migration:', error instanceof Error ? error.message : String(error))
        process.exit(1)
    }
}

void main()
