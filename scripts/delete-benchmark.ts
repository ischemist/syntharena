#!/usr/bin/env tsx

/*
 * pnpm tsx scripts/delete-benchmark.ts ref-lng-84
 */
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@prisma/client'

import './env-loader'

import { deleteBenchmark as deleteBenchmarkFromService } from '../src/lib/services/benchmark.service'

const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL,
})

const prisma = new PrismaClient({ adapter })

async function deleteBenchmark(benchmarkName: string) {
    console.log(`Deleting benchmark: ${benchmarkName}`)

    // Find the benchmark to get its ID
    const benchmark = await prisma.benchmarkSet.findUnique({
        where: { name: benchmarkName },
        select: { id: true, name: true },
    })

    if (!benchmark) {
        console.log(`Benchmark "${benchmarkName}" not found`)
        return
    }

    console.log(`Found benchmark: ${benchmark.name} (ID: ${benchmark.id})`)

    // Use the transactional service function for deletion
    await deleteBenchmarkFromService(benchmark.id)

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
