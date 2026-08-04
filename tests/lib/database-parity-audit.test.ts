import crypto from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'

import { auditDatabaseParity } from '@/lib/database-parity-audit'

const directories: string[] = []

function createFixture(databasePath: string, generatedAt: string): void {
    const migration = fs.readFileSync(
        path.resolve('prisma/migrations/20260803000000_initial_solv_n/migration.sql'),
        'utf8'
    )
    const database = new Database(databasePath)
    try {
        database.exec(migration)
        database.exec(`
            CREATE TABLE "_prisma_migrations" (
                "id" TEXT PRIMARY KEY NOT NULL,
                "checksum" TEXT NOT NULL,
                "finished_at" DATETIME,
                "migration_name" TEXT NOT NULL,
                "logs" TEXT,
                "rolled_back_at" DATETIME,
                "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
                "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
            )
        `)
        database
            .prepare(
                `INSERT INTO _prisma_migrations
                 (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
                 VALUES (?, ?, ?, ?, ?, 1)`
            )
            .run(
                crypto.randomUUID(),
                crypto.createHash('sha256').update(migration).digest('hex'),
                Date.now(),
                '20260803000000_initial_solv_n',
                Date.now() - 1
            )
        database
            .prepare(
                `INSERT INTO DatabaseMetadata
                 (id, databaseSchemaVersion, artifactSchemaVersion, inventorySchemaVersion,
                  inventorySha256, catalogSha256, legacyUrlAliasesSha256, identityBaselineSha256,
                  producerTrustPolicySha256, retrocastVersion, publicationStatus, benchmarkCount,
                  modelCount, expectedRunCount, importedRunCount, evaluationTargetCount,
                  candidateCount, routeCount, failureCount, generatedAt)
                 VALUES ('syntharena', 2, '2', '1', ?, ?, NULL, NULL, ?, '0.8.3', 'local-provisional',
                         0, 0, 0, 0, 0, 0, 0, 0, ?)`
            )
            .run('a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64), generatedAt)
    } finally {
        database.close()
    }
}

afterEach(() => {
    for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true })
})

describe('auditDatabaseParity', () => {
    it('ignores generated bookkeeping timestamps but rejects semantic row drift', () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'syntharena-parity-test-'))
        directories.push(directory)
        const reference = path.join(directory, 'reference.db')
        const candidate = path.join(directory, 'candidate.db')
        createFixture(reference, '2026-08-03T00:00:00.000Z')
        createFixture(candidate, '2026-08-04T00:00:00.000Z')

        expect(() => auditDatabaseParity(reference, candidate)).not.toThrow()

        const database = new Database(candidate)
        database.prepare(`UPDATE DatabaseMetadata SET candidateCount = 1, routeCount = 1 WHERE id = 'syntharena'`).run()
        database.close()

        expect(() => auditDatabaseParity(reference, candidate)).toThrow('database metadata differs at row 1')
    })
})
