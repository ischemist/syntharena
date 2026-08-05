import { execFileSync, spawnSync } from 'node:child_process'
import {
    chmodSync,
    existsSync,
    lstatSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readlinkSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, test } from 'vitest'

const repoRoot = resolve(import.meta.dirname, '../..')
const wrapper = join(repoRoot, 'deployment/ssh/syntharena-deploy-command')
const installer = join(repoRoot, 'scripts/install-production-deploy.sh')
const deploymentSha = '1'.repeat(40)
const imageDigest = `sha256:${'2'.repeat(64)}`

function executable(path: string, body: string) {
    writeFileSync(path, body)
    chmodSync(path, 0o755)
}

function fixture() {
    const root = mkdtempSync(join(tmpdir(), 'syntharena-production-boundary-'))
    const bin = join(root, 'bin')
    const config = join(root, 'var/www/syntharena')
    const app = join(config, 'app')
    const log = join(root, 'commands.log')
    mkdirSync(bin, { recursive: true })
    mkdirSync(join(app, '.git'), { recursive: true })
    mkdirSync(join(config, 'production_data'), { recursive: true })
    mkdirSync(join(app, 'scripts'), { recursive: true })
    writeFileSync(join(config, '.env'), 'PRESERVE=env\n')
    writeFileSync(join(config, 'production_data/preserve'), 'database\n')
    writeFileSync(join(config, 'legacy-container-preserved'), 'port-1000\n')
    writeFileSync(log, '')
    executable(
        join(app, 'scripts/deploy.sh'),
        `#!/usr/bin/env bash
printf 'deploy cwd=%s data=%s args=%s\n' "$PWD" "$SYNTHARENA_DATA_DIR" "$*" >>"$COMMAND_LOG"
`
    )
    executable(
        join(bin, 'git'),
        `#!/usr/bin/env bash
printf 'git %s\n' "$*" >>"$COMMAND_LOG"
if [ "$1" = clone ]; then
    destination="\${@: -1}"
    mkdir -p "$destination/.git"
    exit 0
fi
if [ "$1" = -C ] && [ "\${3:-}" = checkout ] && [ -n "\${REAL_WRAPPER:-}" ]; then
    mkdir -p "$2/deployment/ssh"
    cp "$REAL_WRAPPER" "$2/deployment/ssh/syntharena-deploy-command"
fi
case "$*" in
  *'remote get-url origin'*) printf 'https://github.com/ischemist/syntharena.git\n' ;;
  *'status --porcelain'*) ;;
  *'rev-parse HEAD'*) printf '%s\n' "$DEPLOYMENT_SHA" ;;
  *'show '*':deployment/contract-version'*) printf '2\n' ;;
  *'merge-base --is-ancestor'*) [ "\${FAIL_ANCESTRY:-0}" != 1 ] ;;
esac
`
    )
    executable(
        join(bin, 'docker'),
        `#!/usr/bin/env bash
printf 'docker %s config=%s\n' "$*" "\${DOCKER_CONFIG:-unset}" >>"$COMMAND_LOG"
if [[ "$*" == *' login '* ]]; then cat >/dev/null; fi
`
    )
    executable(
        join(bin, 'flock'),
        `#!/usr/bin/env bash
[ "\${FLOCK_FAIL:-0}" != 1 ]
`
    )
    executable(
        join(bin, 'install'),
        `#!/usr/bin/env bash
if [ "\${FAIL_INSTALL:-0}" = 1 ] && [[ "$*" == *syntharena-deploy-command* ]]; then exit 1; fi
exec /usr/bin/install "$@"
`
    )
    return { app, bin, config, log, root }
}

function createDeployKey(root: string) {
    const privateKey = join(root, 'deploy-key')
    execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'syntharena-ci', '-f', privateKey])
    return `${privateKey}.pub`
}

describe('forced production deploy command', () => {
    test('rejects every command outside the exact deployment grammar', () => {
        const f = fixture()
        try {
            const result = spawnSync('bash', [wrapper], {
                encoding: 'utf8',
                env: {
                    ...process.env,
                    COMMAND_LOG: f.log,
                    PATH: `${f.bin}:${process.env.PATH}`,
                    SSH_ORIGINAL_COMMAND: `bash -c 'syntharena-deploy ${deploymentSha} ${imageDigest} anmorgunov'`,
                    SYNTHARENA_TEST_ROOT: f.root,
                },
            })
            expect(result.status).toBe(64)
            expect(result.stderr).toContain('rejected deployment command')
            expect(readFileSync(f.log, 'utf8')).toBe('')
        } finally {
            rmSync(f.root, { recursive: true })
        }
    })

    test('authenticates ephemerally and checks out only the requested master revision', () => {
        const f = fixture()
        try {
            const result = spawnSync('bash', [wrapper], {
                encoding: 'utf8',
                input: 'job-scoped-token',
                env: {
                    ...process.env,
                    COMMAND_LOG: f.log,
                    DEPLOYMENT_SHA: deploymentSha,
                    PATH: `${f.bin}:${process.env.PATH}`,
                    SSH_ORIGINAL_COMMAND: `syntharena-deploy ${deploymentSha} ${imageDigest} anmorgunov`,
                    SYNTHARENA_TEST_ROOT: f.root,
                },
            })
            const commands = readFileSync(f.log, 'utf8')
            expect(result.status, result.stderr).toBe(0)
            expect(commands).toContain(`fetch --no-tags origin master`)
            expect(commands).toContain(`checkout --detach ${deploymentSha}`)
            expect(commands).toContain(
                `deploy cwd=${f.app} data=${f.config}/production_data args=${deploymentSha} ${imageDigest}`
            )
            expect(readlinkSync(join(f.app, '.env'))).toBe('../.env')
            expect(commands).toContain('login ghcr.io --username anmorgunov --password-stdin')
            expect(commands).toContain('logout ghcr.io')
        } finally {
            rmSync(f.root, { recursive: true })
        }
    })

    test('rejects a concurrent forced-command deployment before fetch or checkout', () => {
        const f = fixture()
        try {
            const result = spawnSync('bash', [wrapper], {
                encoding: 'utf8',
                input: 'job-scoped-token',
                env: {
                    ...process.env,
                    COMMAND_LOG: f.log,
                    FLOCK_FAIL: '1',
                    PATH: `${f.bin}:${process.env.PATH}`,
                    SSH_ORIGINAL_COMMAND: `syntharena-deploy ${deploymentSha} ${imageDigest} anmorgunov`,
                    SYNTHARENA_TEST_ROOT: f.root,
                },
            })
            const commands = readFileSync(f.log, 'utf8')
            expect(result.status).not.toBe(0)
            expect(result.stderr).toContain('another SynthArena deployment')
            expect(commands).not.toContain('fetch --no-tags')
            expect(commands).not.toContain('checkout --detach')
            expect(commands).not.toContain('deploy cwd=')
        } finally {
            rmSync(f.root, { recursive: true })
        }
    })
})

describe('production checkout bootstrap', () => {
    test('rejects a malformed or hardware-bound deployment public key before cloning', () => {
        const f = fixture()
        const key = join(f.root, 'invalid.pub')
        writeFileSync(key, 'sk-ssh-ed25519@openssh.com not-a-key personal-yubikey\n')
        try {
            const result = spawnSync('bash', [installer, key], {
                cwd: repoRoot,
                encoding: 'utf8',
                env: {
                    ...process.env,
                    COMMAND_LOG: f.log,
                    PATH: `${f.bin}:${process.env.PATH}`,
                    SYNTHARENA_TEST_ROOT: f.root,
                },
            })
            expect(result.status).not.toBe(0)
            expect(result.stderr).toContain('not a valid SSH key')
            expect(readFileSync(f.log, 'utf8')).toBe('')
        } finally {
            rmSync(f.root, { recursive: true })
        }
    })

    test('preserves config/data and installs one restricted dedicated key', () => {
        const f = fixture()
        const key = createDeployKey(f.root)
        try {
            const run = () =>
                spawnSync('bash', [installer, key], {
                    cwd: repoRoot,
                    encoding: 'utf8',
                    env: {
                        ...process.env,
                        COMMAND_LOG: f.log,
                        DEPLOYMENT_SHA: deploymentSha,
                        PATH: `${f.bin}:${process.env.PATH}`,
                        REAL_WRAPPER: wrapper,
                        SYNTHARENA_TEST_ROOT: f.root,
                    },
                })

            const first = run()
            const second = run()
            const keys = readFileSync(join(f.root, 'root/.ssh/authorized_keys'), 'utf8')
            const [, keyBlob, keyComment] = readFileSync(key, 'utf8').trim().split(/\s+/, 3)
            expect(first.status, first.stderr).toBe(0)
            expect(second.status, second.stderr).toBe(0)
            expect(readFileSync(join(f.config, '.env'), 'utf8')).toBe('PRESERVE=env\n')
            expect(readFileSync(join(f.config, 'production_data/preserve'), 'utf8')).toBe('database\n')
            expect(readFileSync(join(f.config, 'legacy-container-preserved'), 'utf8')).toBe('port-1000\n')
            expect(lstatSync(join(f.config, 'app/.env')).isSymbolicLink()).toBe(true)
            expect(keys.split(keyBlob)).toHaveLength(2)
            expect(keys.trim()).toBe(
                `restrict,command="${join(f.root, 'usr/local/sbin/syntharena-deploy-command')}" ssh-ed25519 ${keyBlob} ${keyComment}`
            )
        } finally {
            rmSync(f.root, { recursive: true })
        }
    })

    test('restores the prior checkout and host configuration when bootstrap validation fails', () => {
        const f = fixture()
        const key = createDeployKey(f.root)
        writeFileSync(join(f.app, 'prior-checkout'), 'keep\n')
        try {
            const result = spawnSync('bash', [installer, key], {
                cwd: repoRoot,
                encoding: 'utf8',
                env: {
                    ...process.env,
                    COMMAND_LOG: f.log,
                    DEPLOYMENT_SHA: deploymentSha,
                    FAIL_INSTALL: '1',
                    PATH: `${f.bin}:${process.env.PATH}`,
                    REAL_WRAPPER: wrapper,
                    SYNTHARENA_TEST_ROOT: f.root,
                },
            })
            expect(result.status).not.toBe(0)
            expect(readFileSync(join(f.app, 'prior-checkout'), 'utf8')).toBe('keep\n')
            expect(readFileSync(join(f.config, '.env'), 'utf8')).toBe('PRESERVE=env\n')
            expect(readFileSync(join(f.config, 'production_data/preserve'), 'utf8')).toBe('database\n')
            expect(existsSync(join(f.root, 'usr/local/sbin/syntharena-deploy-command'))).toBe(false)
            expect(existsSync(join(f.root, 'root/.ssh/authorized_keys'))).toBe(false)
        } finally {
            rmSync(f.root, { recursive: true })
        }
    })
})
