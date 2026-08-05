import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, test } from 'vitest'

import databaseContract from '../../deployment/database-contract.json'

const repoRoot = resolve(import.meta.dirname, '../..')
const deployScript = join(repoRoot, 'scripts/deploy.sh')
const composeFile = join(repoRoot, 'docker-compose.yml')
const deploymentSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
}).trim()
const imageDigest = `sha256:${'a'.repeat(64)}`
const contractSha = createHash('sha256')
    .update(readFileSync(join(repoRoot, 'deployment/database-contract.json')))
    .digest('hex')

type DeploymentResult = {
    commands: string
    slot: string
    status: number | null
    signal: NodeJS.Signals | null
    stderr: string
}

function writeExecutable(path: string, contents: string) {
    writeFileSync(path, contents)
    chmodSync(path, 0o755)
}

function runDeployment(options: {
    initialSlot: 'legacy' | 'blue'
    failCandidateStart?: boolean
    failFirstPublicHealth?: boolean
    lockUnavailable?: boolean
    reportedDatabaseVersion?: number
    reportedDeploymentSha?: string
    reportedInventorySha256?: string
    signalAt?: 'pre-cutover' | 'post-cutover' | 'mid-switch' | 'mid-retirement'
    signalName?: 'HUP' | 'INT' | 'TERM'
}): DeploymentResult {
    const fixtureDir = mkdtempSync(join(tmpdir(), 'syntharena-deploy-test-'))
    const fakeBin = join(fixtureDir, 'bin')
    const commandLog = join(fixtureDir, 'commands.log')
    const slotFile = join(fixtureDir, 'active-slot')
    const publicFailureMarker = join(fixtureDir, 'public-health-failed')
    const signalMarker = join(fixtureDir, 'signal-sent')
    const switchHelper = join(fakeBin, 'syntharena-switch-upstream')

    try {
        mkdirSync(fakeBin)
        writeFileSync(commandLog, '')
        writeFileSync(slotFile, `${options.initialSlot}\n`)

        writeExecutable(
            join(fakeBin, 'flock'),
            `#!/usr/bin/env bash
printf 'flock %s\n' "$*" >>"$DEPLOY_COMMAND_LOG"
[ "\${FLOCK_FAIL:-0}" != 1 ]
`
        )
        writeExecutable(
            join(fakeBin, 'docker'),
            `#!/usr/bin/env bash
printf 'control COMPOSE_FILE=%s COMPOSE_ENV_FILES=%s COMPOSE_PROFILES=%s\n' \
    "\${COMPOSE_FILE-unset}" "\${COMPOSE_ENV_FILES-unset}" "\${COMPOSE_PROFILES-unset}" >>"$DEPLOY_COMMAND_LOG"
printf 'docker %s\n' "$*" >>"$DEPLOY_COMMAND_LOG"
if [[ "$*" == image\\ inspect* ]] && [[ "$*" == *org.opencontainers.image.revision* ]]; then
    printf '%s\n' "$DEPLOYMENT_SHA"
    exit 0
fi
if [[ "$*" == image\\ inspect* ]] && [[ "$*" == *RepoDigests* ]]; then
    printf 'ghcr.io/ischemist/syntharena@%s\n' "$IMAGE_DIGEST"
    exit 0
fi
if [[ "$*" == run\\ --rm\\ --entrypoint\\ sha256sum* ]]; then
    printf '%s  /app/deployment/database-contract.json\n' "$CONTRACT_SHA"
    exit 0
fi
if [[ "$*" == run\\ --rm\\ --entrypoint\\ node* ]]; then
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
        "$EXPECTED_DATABASE_VERSION" \
        "$EXPECTED_ARTIFACT_SCHEMA_VERSION" \
        "$EXPECTED_INVENTORY_SCHEMA_VERSION" \
        "$EXPECTED_INVENTORY_SHA256" \
        "$EXPECTED_CATALOG_SHA256" \
        "$EXPECTED_LEGACY_URL_ALIASES_SHA256" \
        "$EXPECTED_PRODUCER_TRUST_POLICY_SHA256" \
        "$EXPECTED_RETROCAST_VERSION"
    exit 0
fi
if [ "\${SIGNAL_AT:-}" = pre-cutover ] && [[ "$*" == *'up -d --no-build --wait app-green'* ]] && [ ! -f "$SIGNAL_MARKER" ]; then
    touch "$SIGNAL_MARKER"
    kill "-$SIGNAL_NAME" "$PPID"
    exit 0
fi
if [ "\${SIGNAL_AT:-}" = mid-retirement ] && [[ "$*" == *'stop app-blue'* ]] && [ ! -f "$SIGNAL_MARKER" ]; then
    touch "$SIGNAL_MARKER"
    kill "-$SIGNAL_NAME" "$PPID"
    exit 0
fi
if [ "\${FAIL_CANDIDATE_START:-0}" = 1 ] && [[ "$*" == *'up -d --no-build --wait app-green'* ]]; then
    exit 1
fi
`
        )
        writeExecutable(
            join(fakeBin, 'curl'),
            `#!/usr/bin/env bash
url="\${@: -1}"
printf 'curl %s\n' "$*" >>"$DEPLOY_COMMAND_LOG"
if [ "\${SIGNAL_AT:-}" = post-cutover ] && [[ "$url" == "$SYNTHARENA_PUBLIC_URL/api/health" ]] && [ ! -f "$SIGNAL_MARKER" ]; then
    touch "$SIGNAL_MARKER"
    kill "-$SIGNAL_NAME" "$PPID"
    exit 0
fi
if [ "\${FAIL_FIRST_PUBLIC_HEALTH:-0}" = 1 ] && [[ "$url" == "$SYNTHARENA_PUBLIC_URL"* ]] && [ ! -f "$PUBLIC_FAILURE_MARKER" ]; then
    touch "$PUBLIC_FAILURE_MARKER"
    exit 22
fi
if [[ "$url" == */api/deployment ]]; then
    printf '{"deploymentId":"%s","database":{"databaseSchemaVersion":%s,"artifactSchemaVersion":"%s","inventorySchemaVersion":"%s","inventorySha256":"%s","catalogSha256":"%s","legacyUrlAliasesSha256":"%s","producerTrustPolicySha256":"%s","retrocastVersion":"%s"}}\n' \
        "$REPORTED_DEPLOYMENT_SHA" \
        "$REPORTED_DATABASE_VERSION" \
        "$ARTIFACT_SCHEMA_VERSION" \
        "$INVENTORY_SCHEMA_VERSION" \
        "$INVENTORY_SHA256" \
        "$CATALOG_SHA256" \
        "$LEGACY_URL_ALIASES_SHA256" \
        "$PRODUCER_TRUST_POLICY_SHA256" \
        "$RETROCAST_VERSION"
fi
`
        )
        writeExecutable(
            join(fakeBin, 'sudo'),
            `#!/usr/bin/env bash
if [ "\${1:-}" = -n ]; then shift; fi
"$@"
`
        )
        writeExecutable(
            join(fakeBin, 'sleep'),
            `#!/usr/bin/env bash
printf 'sleep %s\n' "$*" >>"$DEPLOY_COMMAND_LOG"
`
        )
        writeExecutable(
            switchHelper,
            `#!/usr/bin/env bash
if [ "$1" = current ]; then
    cat "$DEPLOY_SLOT_FILE"
    printf 'switch current\n' >>"$DEPLOY_COMMAND_LOG"
    exit 0
fi
printf '%s\n' "$1" >"$DEPLOY_SLOT_FILE"
printf 'switch %s\n' "$1" >>"$DEPLOY_COMMAND_LOG"
if [ "\${SIGNAL_AT:-}" = mid-switch ] && [ ! -f "$SIGNAL_MARKER" ]; then
    touch "$SIGNAL_MARKER"
    kill "-$SIGNAL_NAME" "$PPID"
fi
printf '%s\n' "$1"
`
        )

        const result = spawnSync('bash', [deployScript, deploymentSha, imageDigest], {
            cwd: repoRoot,
            encoding: 'utf8',
            env: {
                ...process.env,
                PATH: `${fakeBin}:${process.env.PATH}`,
                ARTIFACT_SCHEMA_VERSION: databaseContract.artifactSchemaVersion,
                CATALOG_SHA256: databaseContract.catalogSha256,
                COMPOSE_ENV_FILES: '/tmp/untrusted.env',
                COMPOSE_FILE: '/tmp/untrusted-compose.yml',
                COMPOSE_PROFILES: 'untrusted',
                CONTRACT_SHA: contractSha,
                DEPLOYMENT_SHA: deploymentSha,
                DEPLOY_COMMAND_LOG: commandLog,
                DEPLOY_SLOT_FILE: slotFile,
                FAIL_CANDIDATE_START: options.failCandidateStart ? '1' : '0',
                FAIL_FIRST_PUBLIC_HEALTH: options.failFirstPublicHealth ? '1' : '0',
                FLOCK_FAIL: options.lockUnavailable ? '1' : '0',
                IMAGE_DIGEST: imageDigest,
                EXPECTED_ARTIFACT_SCHEMA_VERSION: databaseContract.artifactSchemaVersion,
                EXPECTED_CATALOG_SHA256: databaseContract.catalogSha256,
                EXPECTED_DATABASE_VERSION: String(databaseContract.databaseSchemaVersion),
                EXPECTED_INVENTORY_SCHEMA_VERSION: databaseContract.inventorySchemaVersion,
                EXPECTED_INVENTORY_SHA256: databaseContract.inventorySha256,
                EXPECTED_LEGACY_URL_ALIASES_SHA256: databaseContract.legacyUrlAliasesSha256,
                EXPECTED_PRODUCER_TRUST_POLICY_SHA256: databaseContract.producerTrustPolicySha256,
                EXPECTED_RETROCAST_VERSION: databaseContract.retrocastVersion,
                INVENTORY_SCHEMA_VERSION: databaseContract.inventorySchemaVersion,
                INVENTORY_SHA256: options.reportedInventorySha256 ?? databaseContract.inventorySha256,
                LEGACY_URL_ALIASES_SHA256: databaseContract.legacyUrlAliasesSha256,
                PRODUCER_TRUST_POLICY_SHA256: databaseContract.producerTrustPolicySha256,
                PUBLIC_FAILURE_MARKER: publicFailureMarker,
                REPORTED_DATABASE_VERSION: String(options.reportedDatabaseVersion ?? 2),
                REPORTED_DEPLOYMENT_SHA: options.reportedDeploymentSha ?? deploymentSha,
                RETROCAST_VERSION: databaseContract.retrocastVersion,
                SIGNAL_AT: options.signalAt ?? '',
                SIGNAL_MARKER: signalMarker,
                SIGNAL_NAME: options.signalName ?? 'TERM',
                SYNTHARENA_DEPLOY_LOCK_FILE: join(fixtureDir, 'deploy.lock'),
                SYNTHARENA_DRAIN_SECONDS: '0',
                SYNTHARENA_PUBLIC_URL: 'https://public.example',
                SYNTHARENA_SWITCH_UPSTREAM_BIN: switchHelper,
            },
        })

        return {
            commands: readFileSync(commandLog, 'utf8'),
            slot: readFileSync(slotFile, 'utf8').trim(),
            status: result.status,
            signal: result.signal,
            stderr: result.stderr,
        }
    } finally {
        rmSync(fixtureDir, { force: true, recursive: true })
    }
}

describe('blue/green deployment script', () => {
    test('pins the digest and validates the inactive slot before switching traffic', () => {
        const result = runDeployment({ initialSlot: 'legacy' })
        const composePrefix = `docker compose --project-name syntharena --project-directory ${repoRoot} --env-file ${repoRoot}/.env -f ${composeFile}`

        expect(result.status, `${result.stderr}\n${result.commands}`).toBe(0)
        expect(result.slot, `${result.stderr}\n${result.commands}`).toBe('blue')
        expect(result.commands).toContain(`${composePrefix} up -d --no-build --wait app-blue`)
        expect(result.commands).toContain(`ghcr.io/ischemist/syntharena@${imageDigest}`)
        expect(result.commands).toContain('curl --fail --silent --show-error --connect-timeout 5 --max-time 15')
        expect(result.commands).toContain('http://127.0.0.1:1001/api/deployment')
        expect(result.commands).toContain('switch blue')
        expect(result.commands).toContain('https://public.example/api/deployment')
        expect(result.commands.indexOf('switch blue')).toBeGreaterThan(
            result.commands.indexOf('http://127.0.0.1:1001/api/deployment')
        )
        expect(result.commands).toContain('COMPOSE_FILE=unset COMPOSE_ENV_FILES=unset COMPOSE_PROFILES=unset')
        expect(result.commands).not.toContain('/tmp/untrusted-compose.yml')
        expect(result.commands).not.toContain('migrate')
        expect(result.commands).not.toContain('prod.db')
    })

    test('refuses a concurrent deployment before inspecting the active slot', () => {
        const result = runDeployment({ initialSlot: 'blue', lockUnavailable: true })

        expect(result.status).not.toBe(0)
        expect(result.commands).toContain('flock -n 9')
        expect(result.commands).not.toContain('switch current')
        expect(result.stderr).toContain('another SynthArena deployment')
    })

    test('switches traffic back and stops the candidate when public health fails', () => {
        const result = runDeployment({ initialSlot: 'blue', failFirstPublicHealth: true })

        expect(result.status).not.toBe(0)
        expect(result.slot, `${result.stderr}\n${result.commands}`).toBe('blue')
        expect(result.commands).toContain('switch green')
        expect(result.commands).toContain('switch blue')
        expect(result.commands).toContain('stop app-green')
        expect(result.stderr).toContain('restored Nginx to the blue slot')
    })

    test('TERM before cutover stops the candidate without moving traffic', () => {
        const result = runDeployment({ initialSlot: 'blue', signalAt: 'pre-cutover', signalName: 'TERM' })

        expect(result.status).toBe(143)
        expect(result.slot).toBe('blue')
        expect(result.commands).not.toContain('switch green')
        expect(result.commands).toContain('stop app-green')
        expect(result.stderr).toContain('received TERM; starting rollback')
    })

    test('HUP after cutover restores traffic and stops the candidate', () => {
        const result = runDeployment({ initialSlot: 'blue', signalAt: 'post-cutover', signalName: 'HUP' })

        expect(result.status).toBe(129)
        expect(result.slot).toBe('blue')
        expect(result.commands).toContain('switch green')
        expect(result.commands).toContain('switch blue')
        expect(result.commands).toContain('stop app-green')
        expect(result.stderr).toContain('received HUP; starting rollback')
    })

    test('HUP during the switch helper restores the previous upstream', () => {
        const result = runDeployment({ initialSlot: 'blue', signalAt: 'mid-switch', signalName: 'HUP' })

        expect(result.status).toBe(129)
        expect(result.slot).toBe('blue')
        expect(result.commands).toContain('switch green')
        expect(result.commands).toContain('switch blue')
        expect(result.commands).toContain('stop app-green')
    })

    test('TERM during old-slot retirement leaves the committed candidate live', () => {
        const result = runDeployment({ initialSlot: 'blue', signalAt: 'mid-retirement', signalName: 'TERM' })

        expect(result.status).toBeNull()
        expect(result.signal).toBe('SIGTERM')
        expect(result.slot).toBe('green')
        expect(result.commands).toContain('switch green')
        expect(result.commands).not.toContain('switch blue')
        expect(result.commands).toContain('stop app-blue')
    })

    test('does not switch traffic when the candidate reports the wrong database schema', () => {
        const result = runDeployment({ initialSlot: 'blue', reportedDatabaseVersion: 1 })

        expect(result.status).not.toBe(0)
        expect(result.slot).toBe('blue')
        expect(result.commands).not.toContain('switch green')
        expect(result.commands).toContain('stop app-green')
        expect(result.stderr).toContain('did not report deployment')
    })

    test('does not accept an unrelated database with the same schema version', () => {
        const result = runDeployment({ initialSlot: 'blue', reportedInventorySha256: '0'.repeat(64) })

        expect(result.status).not.toBe(0)
        expect(result.slot).toBe('blue')
        expect(result.commands).not.toContain('switch green')
        expect(result.commands).toContain('stop app-green')
        expect(result.stderr).toContain('reviewed database identity')
    })

    test('stops a candidate that fails while Compose is waiting for health', () => {
        const result = runDeployment({ initialSlot: 'blue', failCandidateStart: true })

        expect(result.status).not.toBe(0)
        expect(result.slot).toBe('blue')
        expect(result.commands).not.toContain('switch green')
        expect(result.commands).toContain('stop app-green')
    })
})
