import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { auditDatabaseParity } from '@/lib/database-parity-audit'

function valueAfter(arguments_: string[], flag: string): string | undefined {
    const index = arguments_.indexOf(flag)
    return index === -1 ? undefined : arguments_[index + 1]
}

const arguments_ = process.argv.slice(2).filter((argument) => argument !== '--')
const reference = valueAfter(arguments_, '--reference')
const candidate = valueAfter(arguments_, '--candidate')
if (!reference || !candidate) {
    throw new Error('Usage: pnpm audit:database-parity -- --reference <reference.db> --candidate <candidate.db>')
}

const result = auditDatabaseParity(reference, candidate)
console.log(
    `Semantic database parity passed: ${result.tablesCompared} tables, ` +
        `${result.datasetsCompared} datasets, ${result.rowsCompared} canonical rows.`
)
for (const [dataset, digest] of Object.entries(result.datasetDigests)) {
    console.log(`${digest}  ${dataset}`)
}

const smokeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'syntharena-migrate-deploy-'))
const smokeDatabase = path.join(smokeDirectory, 'candidate.db')
try {
    fs.copyFileSync(path.resolve(candidate), smokeDatabase, fs.constants.COPYFILE_EXCL)
    const output = execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: `file:${smokeDatabase}` },
        encoding: 'utf8',
    })
    auditDatabaseParity(candidate, smokeDatabase)
    console.log('Prisma migrate-deploy smoke passed on an isolated candidate copy with no semantic changes.')
    if (!output.includes('No pending migrations to apply.')) {
        console.log(output.trim())
    }
} finally {
    fs.rmSync(smokeDirectory, { recursive: true, force: true })
}
