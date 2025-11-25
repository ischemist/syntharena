#!/usr/bin/env tsx
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

// Load environment variables FIRST
config({ path: '.env' })

const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL,
})

const prisma = new PrismaClient({ adapter })

async function deleteBenchmark(benchmarkName: string) {
    console.log(`Deleting benchmark: ${benchmarkName}`)

    // Find the benchmark
    const benchmark = await prisma.benchmarkSet.findUnique({
        where: { name: benchmarkName },
        select: { id: true, name: true },
    })

    if (!benchmark) {
        console.log(`Benchmark "${benchmarkName}" not found`)
        return
    }

    console.log(`Found benchmark: ${benchmark.name} (ID: ${benchmark.id})`)

    // Delete in the correct order to respect foreign key constraints
    console.log('Deleting route nodes...')
    await prisma.routeNode.deleteMany({
        where: {
            route: {
                target: {
                    benchmarkSetId: benchmark.id,
                },
            },
        },
    })

    console.log('Deleting routes...')
    await prisma.route.deleteMany({
        where: {
            target: {
                benchmarkSetId: benchmark.id,
            },
        },
    })

    console.log('Deleting benchmark targets...')
    await prisma.benchmarkTarget.deleteMany({
        where: { benchmarkSetId: benchmark.id },
    })

    console.log('Deleting benchmark set...')
    await prisma.benchmarkSet.delete({
        where: { id: benchmark.id },
    })

    console.log('Benchmark deleted successfully!')
}

async function main() {
    const args = process.argv.slice(2)

    if (args.length === 0) {
        console.error('Usage: tsx scripts/delete-benchmark.ts <benchmark-name>')
        process.exit(1)
    }

    const benchmarkName = args[0]

    try {
        await deleteBenchmark(benchmarkName)
        process.exit(0)
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error))
        process.exit(1)
    }
}

main()
