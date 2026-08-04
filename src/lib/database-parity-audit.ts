import crypto from 'crypto'
import path from 'path'
import Database from 'better-sqlite3'

type Sqlite = InstanceType<typeof Database>
type Row = Record<string, unknown>

export interface DatabaseParityAuditResult {
    referencePath: string
    candidatePath: string
    tablesCompared: number
    datasetsCompared: number
    rowsCompared: number
    datasetDigests: Record<string, string>
}

interface Dataset {
    name: string
    sql: string
    jsonColumns?: string[]
    timestampColumns?: string[]
}

const DATASETS: Dataset[] = [
    {
        name: 'Prisma migration bookkeeping',
        sql: `
            SELECT checksum, migration_name, logs, rolled_back_at IS NULL AS notRolledBack,
                   finished_at IS NOT NULL AS finished, applied_steps_count
            FROM _prisma_migrations ORDER BY migration_name, checksum
        `,
    },
    {
        name: 'database metadata',
        sql: `
            SELECT id, databaseSchemaVersion, artifactSchemaVersion, inventorySchemaVersion,
                   inventorySha256, retrocastVersion, publicationStatus, benchmarkCount,
                   modelCount, expectedRunCount, importedRunCount, evaluationTargetCount,
                   candidateCount, routeCount, failureCount
            FROM DatabaseMetadata ORDER BY id
        `,
    },
    {
        name: 'stocks and provenance',
        sql: `
            SELECT name, description, sourcePath, sourceSha256, schemaVersion
            FROM Stock ORDER BY name
        `,
    },
    {
        name: 'stock occurrence smiles',
        sql: `
            SELECT s.name AS stock, m.inchikey, si.smiles
            FROM StockItem si
            JOIN Stock s ON s.id = si.stockId
            JOIN Molecule m ON m.id = si.moleculeId
            ORDER BY stock, inchikey, si.smiles
        `,
    },
    {
        name: 'molecule identities',
        sql: `SELECT inchikey, smiles FROM Molecule ORDER BY inchikey, smiles`,
    },
    {
        name: 'benchmarks and provenance',
        sql: `
            SELECT b.name, b.description, s.name AS stock, b.hasAcceptableRoutes,
                   b.sourcePath, b.sourceSha256, b.schemaVersion,
                   b.defaultConstraintsJson, b.targetConstraintsJson, b.series, b.isListed
            FROM BenchmarkSet b JOIN Stock s ON s.id = b.stockId
            ORDER BY b.name
        `,
        jsonColumns: ['defaultConstraintsJson', 'targetConstraintsJson'],
    },
    {
        name: 'benchmark target chemistry',
        sql: `
            SELECT b.name AS benchmark, bt.targetId, m.inchikey, bt.smiles,
                   bt.routeLength, bt.isConvergent, bt.metadata
            FROM BenchmarkTarget bt
            JOIN BenchmarkSet b ON b.id = bt.benchmarkSetId
            JOIN Molecule m ON m.id = bt.moleculeId
            ORDER BY benchmark, bt.targetId
        `,
        jsonColumns: ['metadata'],
    },
    {
        name: 'acceptable routes',
        sql: `
            SELECT b.name AS benchmark, bt.targetId, ar.routeIndex, r.contentHash
            FROM AcceptableRoute ar
            JOIN BenchmarkTarget bt ON bt.id = ar.benchmarkTargetId
            JOIN BenchmarkSet b ON b.id = bt.benchmarkSetId
            JOIN Route r ON r.id = ar.routeId
            ORDER BY benchmark, bt.targetId, ar.routeIndex
        `,
    },
    {
        name: 'algorithms',
        sql: `SELECT slug, name, description, paper, codeUrl, bibtex FROM Algorithm ORDER BY slug`,
    },
    {
        name: 'model families',
        sql: `
            SELECT a.slug AS algorithm, f.slug, f.name, f.description
            FROM ModelFamily f JOIN Algorithm a ON a.id = f.algorithmId
            ORDER BY algorithm, f.slug
        `,
    },
    {
        name: 'model instances',
        sql: `
            SELECT f.slug AS family, mi.slug, mi.description, mi.versionMajor,
                   mi.versionMinor, mi.versionPatch, mi.versionPrerelease, mi.metadata
            FROM ModelInstance mi JOIN ModelFamily f ON f.id = mi.modelFamilyId
            ORDER BY family, mi.slug
        `,
        jsonColumns: ['metadata'],
    },
    {
        name: 'prediction runs and planner provenance',
        sql: `
            SELECT b.name AS benchmark, mi.slug AS model, pr.retrocastVersion,
                   pr.commandParams, pr.executedAt, pr.hourlyCost, pr.totalCost, pr.executionStatsPath,
                   pr.executionStatsSha256, pr.timedTargets, pr.totalWallTime,
                   pr.totalCpuTime, pr.meanWallTime, pr.meanCpuTime,
                   pr.totalCandidates, pr.totalFailures, pr.totalRoutes,
                   pr.avgRouteLength, pr.submissionType, pr.isRetrained
            FROM PredictionRun pr
            JOIN BenchmarkSet b ON b.id = pr.benchmarkSetId
            JOIN ModelInstance mi ON mi.id = pr.modelInstanceId
            ORDER BY benchmark, model
        `,
        jsonColumns: ['commandParams'],
        timestampColumns: ['executedAt'],
    },
    {
        name: 'route identity sets',
        sql: `
            SELECT contentHash, signature, length, isConvergent
            FROM Route ORDER BY contentHash
        `,
    },
    {
        name: 'reaction identity sets',
        sql: `SELECT reactionHash FROM ReactionStep ORDER BY reactionHash`,
    },
    {
        name: 'route-node occurrence evidence',
        sql: `
            SELECT r.contentHash, n.smiles, m.inchikey, n.isLeaf, n.template,
                   n.metadata, rs.reactionHash,
                   parent.smiles AS parentSmiles, pm.inchikey AS parentInchikey
            FROM RouteNode n
            JOIN Route r ON r.id = n.routeId
            JOIN Molecule m ON m.id = n.moleculeId
            LEFT JOIN ReactionStep rs ON rs.id = n.reactionStepId
            LEFT JOIN RouteNode parent ON parent.id = n.parentId
            LEFT JOIN Molecule pm ON pm.id = parent.moleculeId
            ORDER BY r.contentHash, n.smiles, m.inchikey, n.isLeaf, n.template,
                     n.metadata, rs.reactionHash, parentSmiles, parentInchikey
        `,
        jsonColumns: ['metadata'],
    },
    {
        name: 'ranked candidates and failures',
        sql: `
            SELECT b.name AS benchmark, mi.slug AS model, bt.targetId, pc.rank,
                   r.contentHash, pc.metadata, pc.failureCode, pc.failureMessage,
                   pc.failureDetails
            FROM PredictionCandidate pc
            JOIN PredictionRun pr ON pr.id = pc.predictionRunId
            JOIN BenchmarkSet b ON b.id = pr.benchmarkSetId
            JOIN ModelInstance mi ON mi.id = pr.modelInstanceId
            JOIN BenchmarkTarget bt ON bt.id = pc.targetId
            LEFT JOIN Route r ON r.id = pc.routeId
            ORDER BY benchmark, model, bt.targetId, pc.rank
        `,
        jsonColumns: ['metadata', 'failureDetails'],
    },
    {
        name: 'evaluation provenance',
        sql: `
            SELECT b.name AS benchmark, mi.slug AS model, re.metricLabel,
                   s.name AS stock, re.evaluatedTiers, re.taskJson, re.parametersJson,
                   re.analysisJson, re.manifestJson, re.manifestSha256,
                   re.artifactSchema, re.retrocastVersion, re.createdAt
            FROM RunEvaluation re
            JOIN PredictionRun pr ON pr.id = re.predictionRunId
            JOIN BenchmarkSet b ON b.id = pr.benchmarkSetId
            JOIN ModelInstance mi ON mi.id = pr.modelInstanceId
            LEFT JOIN Stock s ON s.id = re.stockId
            ORDER BY benchmark, model, re.metricLabel
        `,
        jsonColumns: ['evaluatedTiers', 'taskJson', 'parametersJson', 'analysisJson', 'manifestJson'],
        timestampColumns: ['createdAt'],
    },
    {
        name: 'target evaluation evidence',
        sql: `
            SELECT b.name AS benchmark, mi.slug AS model, re.metricLabel,
                   bt.targetId, te.effectiveConstraintsJson, te.wallTime, te.cpuTime
            FROM TargetEvaluation te
            JOIN RunEvaluation re ON re.id = te.runEvaluationId
            JOIN PredictionRun pr ON pr.id = te.predictionRunId
            JOIN BenchmarkSet b ON b.id = pr.benchmarkSetId
            JOIN ModelInstance mi ON mi.id = pr.modelInstanceId
            JOIN BenchmarkTarget bt ON bt.id = te.targetId
            ORDER BY benchmark, model, re.metricLabel, bt.targetId
        `,
        jsonColumns: ['effectiveConstraintsJson'],
    },
    {
        name: 'candidate evaluation evidence',
        sql: `
            SELECT b.name AS benchmark, mi.slug AS model, re.metricLabel,
                   bt.targetId, pc.rank, ce.constraintStatus, ce.constraintChecksJson,
                   ce.validityEvidenceJson, ce.matchesAcceptable, ce.matchedAcceptableIndex
            FROM CandidateEvaluation ce
            JOIN RunEvaluation re ON re.id = ce.runEvaluationId
            JOIN PredictionCandidate pc ON pc.id = ce.candidateId
            JOIN PredictionRun pr ON pr.id = ce.predictionRunId
            JOIN BenchmarkSet b ON b.id = pr.benchmarkSetId
            JOIN ModelInstance mi ON mi.id = pr.modelInstanceId
            JOIN BenchmarkTarget bt ON bt.id = ce.targetId
            ORDER BY benchmark, model, re.metricLabel, bt.targetId, pc.rank
        `,
        jsonColumns: ['constraintChecksJson', 'validityEvidenceJson'],
    },
    {
        name: 'tier evidence',
        sql: `
            SELECT b.name AS benchmark, mi.slug AS model, re.metricLabel,
                   bt.targetId, pc.rank, ctr.tier, ctr.status, ctr.checksJson
            FROM CandidateTierResult ctr
            JOIN CandidateEvaluation ce ON ce.id = ctr.candidateEvaluationId
            JOIN RunEvaluation re ON re.id = ce.runEvaluationId
            JOIN PredictionCandidate pc ON pc.id = ce.candidateId
            JOIN PredictionRun pr ON pr.id = ce.predictionRunId
            JOIN BenchmarkSet b ON b.id = pr.benchmarkSetId
            JOIN ModelInstance mi ON mi.id = pr.modelInstanceId
            JOIN BenchmarkTarget bt ON bt.id = ce.targetId
            ORDER BY benchmark, model, re.metricLabel, bt.targetId, pc.rank, ctr.tier
        `,
        jsonColumns: ['checksJson'],
    },
    {
        name: 'metric estimates including Tier-0 and Solv-0',
        sql: `
            SELECT b.name AS benchmark, mi.slug AS model, re.metricLabel,
                   me.metricKey, me.stratum, me.value, me.ciLower, me.ciUpper,
                   me.nSamples, me.reliabilityCode, me.reliabilityMessage
            FROM MetricEstimate me
            JOIN RunEvaluation re ON re.id = me.runEvaluationId
            JOIN PredictionRun pr ON pr.id = re.predictionRunId
            JOIN BenchmarkSet b ON b.id = pr.benchmarkSetId
            JOIN ModelInstance mi ON mi.id = pr.modelInstanceId
            ORDER BY benchmark, model, re.metricLabel, me.metricKey, me.stratum
        `,
    },
    {
        name: 'users without generated timestamps',
        sql: `SELECT username FROM User ORDER BY username`,
    },
]

function canonicalJson(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalJson)
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, nested]) => [key, canonicalJson(nested)])
        )
    }
    if (typeof value === 'number' && Number.isFinite(value)) return Number(value.toPrecision(15))
    return value
}

function normalizeManifestOptionals(value: unknown): unknown {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value
    const manifest = value as Record<string, unknown>
    if (manifest.release_name === null) delete manifest.release_name
    for (const collection of ['source_files', 'output_files']) {
        const files = manifest[collection]
        if (!Array.isArray(files)) continue
        for (const file of files) {
            if (!file || typeof file !== 'object' || Array.isArray(file)) continue
            const record = file as Record<string, unknown>
            if (record.label === null) delete record.label
            if (record.content_hash === null) delete record.content_hash
        }
    }
    return manifest
}

function normalizeConstraintCheckOptionals(value: unknown): unknown {
    if (!Array.isArray(value)) return value
    for (const check of value) {
        if (!check || typeof check !== 'object' || Array.isArray(check)) continue
        const record = check as Record<string, unknown>
        if (record.message === null) delete record.message
    }
    return value
}

function canonicalRow(row: Row, jsonColumns: string[] = [], timestampColumns: string[] = []): Row {
    return Object.fromEntries(
        Object.entries(row).map(([key, value]) => {
            if (jsonColumns.includes(key) && typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value) as unknown
                    const normalized =
                        key === 'manifestJson'
                            ? normalizeManifestOptionals(parsed)
                            : key === 'constraintChecksJson'
                              ? normalizeConstraintCheckOptionals(parsed)
                              : parsed
                    return [key, canonicalJson(normalized)]
                } catch (error) {
                    throw new Error(
                        `Column ${key} contains invalid JSON: ${error instanceof Error ? error.message : String(error)}`
                    )
                }
            }
            if (timestampColumns.includes(key) && (typeof value === 'string' || typeof value === 'number')) {
                const timestamp = new Date(value)
                if (Number.isNaN(timestamp.valueOf())) throw new Error(`Column ${key} contains an invalid timestamp`)
                // Prisma's public DateTime contract is JavaScript Date, whose
                // precision is milliseconds even when producer ISO strings
                // contain additional fractional digits.
                return [key, timestamp.toISOString()]
            }
            return [key, canonicalJson(value)]
        })
    )
}

function stableString(value: unknown): string {
    return JSON.stringify(canonicalJson(value))
}

function firstDifference(
    reference: unknown,
    candidate: unknown,
    location: string = '$'
): { location: string; reference: unknown; candidate: unknown } | null {
    if (Object.is(reference, candidate)) return null
    if (
        reference === null ||
        candidate === null ||
        typeof reference !== 'object' ||
        typeof candidate !== 'object' ||
        Array.isArray(reference) !== Array.isArray(candidate)
    ) {
        return { location, reference, candidate }
    }
    const referenceRecord = reference as Record<string, unknown>
    const candidateRecord = candidate as Record<string, unknown>
    const keys = [...new Set([...Object.keys(referenceRecord), ...Object.keys(candidateRecord)])].sort()
    for (const key of keys) {
        if (!(key in referenceRecord) || !(key in candidateRecord)) {
            return { location: `${location}.${key}`, reference: referenceRecord[key], candidate: candidateRecord[key] }
        }
        const nested = firstDifference(referenceRecord[key], candidateRecord[key], `${location}.${key}`)
        if (nested) return nested
    }
    return null
}

function normalizedSql(sql: string | null): string | null {
    return sql?.replace(/\s+/g, ' ').trim() ?? null
}

function domainTables(database: Sqlite): string[] {
    return (
        database
            .prepare(
                `SELECT name FROM sqlite_master
                 WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
                 ORDER BY name`
            )
            .all() as Array<{ name: string }>
    ).map((row) => row.name)
}

function schemaShape(database: Sqlite): unknown {
    const tables = domainTables(database)
    const tableShapes = tables.map((table) => ({
        table,
        sql: normalizedSql(
            (
                database.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`).get(table) as {
                    sql: string
                }
            ).sql
        ),
        columns: database.prepare(`PRAGMA table_xinfo(${JSON.stringify(table)})`).all(),
        foreignKeys: (database.prepare(`PRAGMA foreign_key_list(${JSON.stringify(table)})`).all() as Array<Row>)
            .map(({ id: _volatileId, ...foreignKey }) => foreignKey)
            .sort((left, right) => stableString(left).localeCompare(stableString(right))),
        indexes: (database.prepare(`PRAGMA index_list(${JSON.stringify(table)})`).all() as Array<Row>)
            .map((index) => {
                const sql = normalizedSql(
                    (
                        database
                            .prepare(`SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?`)
                            .get(index.name) as { sql: string | null } | undefined
                    )?.sql ?? null
                )
                return {
                    // `seq` and SQLite autoindex names reflect creation order,
                    // not schema meaning. Explicit index names remain part of
                    // their normalized SQL contract below.
                    name: sql ? index.name : null,
                    unique: index.unique,
                    origin: index.origin,
                    partial: index.partial,
                    columns: database.prepare(`PRAGMA index_xinfo(${JSON.stringify(String(index.name))})`).all(),
                    sql,
                }
            })
            .sort((left, right) => stableString(left).localeCompare(stableString(right))),
    }))
    const auxiliary = database
        .prepare(
            `SELECT type, name, tbl_name AS tableName, sql FROM sqlite_master
             WHERE type IN ('view', 'trigger') AND name NOT LIKE 'sqlite_%'
             ORDER BY type, name`
        )
        .all()
        .map((row) => ({ ...(row as Row), sql: normalizedSql(String((row as Row).sql)) }))
    return { tables: tableShapes, auxiliary }
}

function assertHealthy(database: Sqlite, label: string): void {
    const integrity = database.prepare('PRAGMA integrity_check').all() as Array<{ integrity_check: string }>
    if (integrity.length !== 1 || integrity[0]?.integrity_check !== 'ok') {
        throw new Error(`${label} failed integrity_check: ${stableString(integrity)}`)
    }
    const foreignKeys = database.prepare('PRAGMA foreign_key_check').all()
    if (foreignKeys.length > 0) {
        throw new Error(
            `${label} has ${foreignKeys.length} foreign-key violations: ${stableString(foreignKeys.slice(0, 5))}`
        )
    }
}

function compareDataset(reference: Sqlite, candidate: Sqlite, dataset: Dataset): { rows: number; digest: string } {
    const referenceRows = reference.prepare(dataset.sql).iterate() as IterableIterator<Row>
    const candidateRows = candidate.prepare(dataset.sql).iterate() as IterableIterator<Row>
    const hash = crypto.createHash('sha256')
    let rows = 0
    try {
        while (true) {
            const left = referenceRows.next()
            const right = candidateRows.next()
            if (left.done || right.done) {
                if (left.done !== right.done) {
                    throw new Error(`${dataset.name} row-count mismatch after ${rows} equal rows`)
                }
                break
            }
            const canonicalLeft = canonicalRow(left.value, dataset.jsonColumns, dataset.timestampColumns)
            const canonicalRight = canonicalRow(right.value, dataset.jsonColumns, dataset.timestampColumns)
            const leftText = stableString(canonicalLeft)
            const rightText = stableString(canonicalRight)
            if (leftText !== rightText) {
                const difference = firstDifference(canonicalLeft, canonicalRight)
                throw new Error(
                    `${dataset.name} differs at row ${rows + 1}${difference ? ` (${difference.location})` : ''}\n` +
                        `reference: ${stableString(difference ? difference.reference : canonicalLeft)}\n` +
                        `candidate: ${stableString(difference ? difference.candidate : canonicalRight)}`
                )
            }
            hash.update(leftText).update('\n')
            rows++
        }
    } finally {
        referenceRows.return?.()
        candidateRows.return?.()
    }
    return { rows, digest: hash.digest('hex') }
}

export function auditDatabaseParity(referencePath: string, candidatePath: string): DatabaseParityAuditResult {
    const resolvedReference = path.resolve(referencePath)
    const resolvedCandidate = path.resolve(candidatePath)
    const reference = new Database(resolvedReference, { readonly: true, fileMustExist: true })
    const candidate = new Database(resolvedCandidate, { readonly: true, fileMustExist: true })
    try {
        assertHealthy(reference, 'Reference database')
        assertHealthy(candidate, 'Candidate database')

        const referenceSchema = stableString(schemaShape(reference))
        const candidateSchema = stableString(schemaShape(candidate))
        if (referenceSchema !== candidateSchema) throw new Error('Domain schema shape differs')

        const tables = domainTables(reference)
        const candidateTables = domainTables(candidate)
        if (stableString(tables) !== stableString(candidateTables)) throw new Error('Domain table sets differ')
        for (const table of tables) {
            const referenceCount = (
                reference.prepare(`SELECT COUNT(*) AS count FROM ${JSON.stringify(table)}`).get() as {
                    count: number
                }
            ).count
            const candidateCount = (
                candidate.prepare(`SELECT COUNT(*) AS count FROM ${JSON.stringify(table)}`).get() as {
                    count: number
                }
            ).count
            if (referenceCount !== candidateCount) {
                throw new Error(`${table} count differs: reference=${referenceCount}, candidate=${candidateCount}`)
            }
        }

        let rowsCompared = 0
        const datasetDigests: Record<string, string> = {}
        for (const dataset of DATASETS) {
            const result = compareDataset(reference, candidate, dataset)
            rowsCompared += result.rows
            datasetDigests[dataset.name] = result.digest
        }
        return {
            referencePath: resolvedReference,
            candidatePath: resolvedCandidate,
            tablesCompared: tables.length,
            datasetsCompared: DATASETS.length,
            rowsCompared,
            datasetDigests,
        }
    } finally {
        reference.close()
        candidate.close()
    }
}
