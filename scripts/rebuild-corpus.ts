import './env-loader'

import { execFileSync } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'

import { promoteFileNoReplace } from '@/lib/atomic-file'

interface Args {
    corpusRoot: string
    outputPath: string
    procrustesRoot?: string
    allowProvisional: boolean
    limit?: number
}

function usage(): never {
    throw new Error(
        'Usage: pnpm rebuild:corpus:reference -- --corpus <corpus-dir> --output <new-database.db> [--procrustes-root <project-procrustes>] [--allow-provisional] [--limit <runs>]'
    )
}

function parseArgs(argv: string[]): Args {
    let corpusRoot: string | undefined
    let outputPath: string | undefined
    let procrustesRoot: string | undefined
    let allowProvisional = false
    let limit: number | undefined
    for (let index = 0; index < argv.length; index++) {
        const argument = argv[index]
        if (argument === '--') continue
        if (argument === '--allow-provisional') allowProvisional = true
        else if (argument === '--corpus') corpusRoot = argv[++index]
        else if (argument === '--output') outputPath = argv[++index]
        else if (argument === '--procrustes-root') procrustesRoot = argv[++index]
        else if (argument === '--limit') limit = Number(argv[++index])
        else usage()
    }
    if (!corpusRoot || !outputPath) usage()
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1))
        throw new Error('--limit must be a positive integer')
    return { corpusRoot, outputPath, procrustesRoot, allowProvisional, limit }
}

async function reserveFreshDatabase(outputPath: string): Promise<string> {
    const resolvedOutput = path.resolve(outputPath)
    try {
        await fs.access(resolvedOutput)
        throw new Error(`Output database already exists: ${resolvedOutput}`)
    } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
    }
    await fs.mkdir(path.dirname(resolvedOutput), { recursive: true })
    const partialPath = `${resolvedOutput}.partial-${process.pid}-${Date.now()}`
    const file = await fs.open(partialPath, 'wx')
    await file.close()
    return partialPath
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2))
    const outputPath = path.resolve(args.outputPath)
    const partialPath = await reserveFreshDatabase(outputPath)
    process.env.DATABASE_URL = `file:${partialPath}`
    try {
        execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { stdio: 'inherit', env: process.env })
        const [{ importCorpusIntoCurrentDatabase }, { default: prisma }] = await Promise.all([
            import('@/lib/services/loaders/corpus-rebuild.service'),
            import('@/lib/db'),
        ])
        const result = await importCorpusIntoCurrentDatabase({
            corpusRoot: path.resolve(args.corpusRoot),
            procrustesRoot: args.procrustesRoot ? path.resolve(args.procrustesRoot) : undefined,
            allowProvisional: args.allowProvisional,
            limit: args.limit,
            onProgress: console.log,
        })
        await prisma.$executeRawUnsafe('PRAGMA optimize')
        const foreignKeyViolations =
            await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>('PRAGMA foreign_key_check')
        if (foreignKeyViolations.length > 0) {
            throw new Error(`Database foreign-key check failed with ${foreignKeyViolations.length} violations`)
        }
        const integrityRows = await prisma.$queryRawUnsafe<Array<Record<string, string>>>('PRAGMA integrity_check')
        if (integrityRows.length !== 1 || Object.values(integrityRows[0])[0] !== 'ok') {
            throw new Error(`Database integrity check failed: ${JSON.stringify(integrityRows)}`)
        }
        await prisma.$disconnect()
        await promoteFileNoReplace(partialPath, outputPath)
        console.log(
            `Corpus rebuild complete at ${outputPath}: ${result.imported} imported, ${result.skipped} verified.`
        )
    } catch (error) {
        await Promise.all(
            ['', '-journal', '-wal', '-shm'].map((suffix) => fs.rm(`${partialPath}${suffix}`, { force: true }))
        )
        throw error
    }
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
})
