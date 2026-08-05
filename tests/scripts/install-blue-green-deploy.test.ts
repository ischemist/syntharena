import { spawnSync } from 'node:child_process'
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { describe, expect, test } from 'vitest'

const repoRoot = resolve(import.meta.dirname, '../..')
const installerScript = join(repoRoot, 'scripts/install-blue-green-deploy.sh')
const switchScript = join(repoRoot, 'deployment/nginx/syntharena-switch-upstream')

type Fixture = ReturnType<typeof createFixture>

function writeExecutable(path: string, contents: string) {
    writeFileSync(path, contents)
    chmodSync(path, 0o755)
}

function rooted(root: string, path: string) {
    return join(root, path.replace(/^\//, ''))
}

function createFixture(
    siteContents = 'server {\n    location / {\n        proxy_pass http://127.0.0.1:1000;\n    }\n}\n'
) {
    const root = mkdtempSync(join(tmpdir(), 'syntharena-blue-green-install-'))
    const fakeBin = join(root, 'fake-bin')
    const commandLog = join(root, 'commands.log')
    const nginxCount = join(root, 'nginx-count')
    const systemctlCount = join(root, 'systemctl-count')
    const sitePath = rooted(root, '/etc/nginx/sites-available/syntharena')
    const siteLink = rooted(root, '/etc/nginx/sites-enabled/syntharena')
    const configDir = rooted(root, '/etc/nginx/syntharena-upstreams')
    const activeLink = rooted(root, '/etc/nginx/conf.d/syntharena-upstream.conf')
    const shutdownConfig = rooted(root, '/etc/nginx/modules-enabled/99-syntharena-worker-shutdown.conf')
    const switchTarget = rooted(root, '/usr/local/sbin/syntharena-switch-upstream')
    const sudoersFile = rooted(root, '/etc/sudoers.d/syntharena-blue-green-deploy')
    const readyDir = rooted(root, '/var/lib/syntharena-deploy')
    const readyMarker = join(readyDir, 'blue-green-ready')

    for (const directory of [
        fakeBin,
        dirname(sitePath),
        dirname(siteLink),
        dirname(activeLink),
        dirname(shutdownConfig),
        dirname(switchTarget),
        dirname(sudoersFile),
        dirname(readyDir),
    ]) {
        mkdirSync(directory, { recursive: true })
    }
    writeFileSync(commandLog, '')
    writeFileSync(sitePath, siteContents)
    symlinkSync(sitePath, siteLink)

    writeExecutable(
        join(fakeBin, 'curl'),
        `#!/usr/bin/env bash
printf 'curl %s\n' "$*" >>"$TEST_COMMAND_LOG"
exit 0
`
    )
    writeExecutable(
        join(fakeBin, 'nginx'),
        `#!/usr/bin/env bash
count=0
[ ! -f "$TEST_NGINX_COUNT" ] || count="$(cat "$TEST_NGINX_COUNT")"
count=$((count + 1))
printf '%s\n' "$count" >"$TEST_NGINX_COUNT"
printf 'nginx[%s] %s\n' "$count" "$*" >>"$TEST_COMMAND_LOG"
if [ "\${NGINX_FAIL_CALL:-0}" = "$count" ]; then exit 1; fi
`
    )
    writeExecutable(
        join(fakeBin, 'systemctl'),
        `#!/usr/bin/env bash
count=0
[ ! -f "$TEST_SYSTEMCTL_COUNT" ] || count="$(cat "$TEST_SYSTEMCTL_COUNT")"
count=$((count + 1))
printf '%s\n' "$count" >"$TEST_SYSTEMCTL_COUNT"
printf 'systemctl[%s] %s\n' "$count" "$*" >>"$TEST_COMMAND_LOG"
if [ "\${SYSTEMCTL_FAIL_CALL:-0}" = "$count" ]; then exit 1; fi
`
    )
    writeExecutable(
        join(fakeBin, 'visudo'),
        `#!/usr/bin/env bash
printf 'visudo %s\n' "$*" >>"$TEST_COMMAND_LOG"
[ "\${VISUDO_FAIL:-0}" != 1 ]
`
    )
    writeExecutable(
        join(fakeBin, 'sed'),
        `#!/usr/bin/env node
const fs = require('node:fs')
const file = process.argv.at(-1)
const contents = fs.readFileSync(file, 'utf8')
fs.writeFileSync(
    file,
    contents
        .replace('http://localhost:1000;', 'http://syntharena_app;')
        .replace('http://127.0.0.1:1000;', 'http://syntharena_app;')
)
`
    )
    writeExecutable(
        join(fakeBin, 'mv'),
        `#!/usr/bin/env bash
if [ "\${1:-}" = -Tf ]; then shift; fi
/bin/mv -f "$@"
`
    )

    const env = {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH}`,
        SYNTHARENA_DEPLOY_USER: 'syntharena-deploy-test',
        SYNTHARENA_NGINX_SITE: siteLink,
        SYNTHARENA_TEST_ROOT: root,
        TEST_COMMAND_LOG: commandLog,
        TEST_NGINX_COUNT: nginxCount,
        TEST_SYSTEMCTL_COUNT: systemctlCount,
    }

    return {
        activeLink,
        commandLog,
        configDir,
        env,
        readyDir,
        readyMarker,
        root,
        shutdownConfig,
        sitePath,
        sudoersFile,
        switchTarget,
    }
}

function cleanupFixture(fixture: Fixture) {
    rmSync(fixture.root, { force: true, recursive: true })
}

function runInstaller(fixture: Fixture, env: Record<string, string> = {}) {
    return spawnSync('bash', [installerScript], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: { ...fixture.env, ...env },
    })
}

function runSwitch(fixture: Fixture, slot: 'blue' | 'green', env: Record<string, string> = {}) {
    return spawnSync('bash', [switchScript, slot], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: { ...fixture.env, ...env },
    })
}

function seedInstalledState(fixture: Fixture) {
    writeFileSync(fixture.sitePath, 'server {\n    proxy_pass http://syntharena_app;\n}\n')
    mkdirSync(fixture.configDir)
    writeFileSync(join(fixture.configDir, 'legacy.conf'), 'old legacy\n')
    writeFileSync(join(fixture.configDir, 'blue.conf'), 'old blue\n')
    writeFileSync(join(fixture.configDir, 'green.conf'), 'old green\n')
    writeFileSync(join(fixture.configDir, 'retained.conf'), 'retain me\n')
    symlinkSync(join(fixture.configDir, 'blue.conf'), fixture.activeLink)
    writeFileSync(fixture.shutdownConfig, 'old shutdown\n')
    writeExecutable(fixture.switchTarget, '#!/usr/bin/env bash\necho old helper\n')
    writeFileSync(fixture.sudoersFile, 'old sudoers\n')
    mkdirSync(fixture.readyDir)
    writeFileSync(fixture.readyMarker, 'old ready marker\n')
}

function seedSwitchState(fixture: Fixture) {
    mkdirSync(fixture.configDir)
    for (const slot of ['legacy', 'blue', 'green']) {
        writeFileSync(join(fixture.configDir, `${slot}.conf`), `${slot}\n`)
    }
    mkdirSync(fixture.readyDir)
    writeFileSync(fixture.readyMarker, 'ready\n')
    symlinkSync(join(fixture.configDir, 'blue.conf'), fixture.activeLink)
}

describe('blue/green deployment installer', () => {
    test('rewrites exactly one legacy proxy_pass and completes a first install', () => {
        const fixture = createFixture()
        try {
            const result = runInstaller(fixture)

            expect(result.status, result.stderr).toBe(0)
            expect(readFileSync(fixture.sitePath, 'utf8')).toContain('proxy_pass http://syntharena_app;')
            expect(readFileSync(fixture.sitePath, 'utf8')).not.toContain('127.0.0.1:1000')
            expect(realpathSync(fixture.activeLink)).toBe(realpathSync(join(fixture.configDir, 'legacy.conf')))
            expect(existsSync(fixture.readyMarker)).toBe(true)
            expect(result.stdout).toContain('active slot: legacy')
        } finally {
            cleanupFixture(fixture)
        }
    })

    test('rolls back every first-install artifact when validation fails', () => {
        const originalSite = 'server {\n    proxy_pass http://localhost:1000;\n}\n'
        const fixture = createFixture(originalSite)
        try {
            const result = runInstaller(fixture, { VISUDO_FAIL: '1' })

            expect(result.status).not.toBe(0)
            expect(readFileSync(fixture.sitePath, 'utf8')).toBe(originalSite)
            expect(existsSync(fixture.configDir)).toBe(false)
            expect(existsSync(fixture.activeLink)).toBe(false)
            expect(existsSync(fixture.shutdownConfig)).toBe(false)
            expect(existsSync(fixture.switchTarget)).toBe(false)
            expect(existsSync(fixture.sudoersFile)).toBe(false)
            expect(existsSync(fixture.readyDir)).toBe(false)
        } finally {
            cleanupFixture(fixture)
        }
    })

    test('restores all prior files and links when a rerun fails', () => {
        const fixture = createFixture()
        try {
            seedInstalledState(fixture)
            const result = runInstaller(fixture, { VISUDO_FAIL: '1' })

            expect(result.status).not.toBe(0)
            expect(readFileSync(fixture.sitePath, 'utf8')).toContain('proxy_pass http://syntharena_app;')
            expect(readFileSync(join(fixture.configDir, 'legacy.conf'), 'utf8')).toBe('old legacy\n')
            expect(readFileSync(join(fixture.configDir, 'retained.conf'), 'utf8')).toBe('retain me\n')
            expect(realpathSync(fixture.activeLink)).toBe(realpathSync(join(fixture.configDir, 'blue.conf')))
            expect(readFileSync(fixture.shutdownConfig, 'utf8')).toBe('old shutdown\n')
            expect(readFileSync(fixture.switchTarget, 'utf8')).toContain('old helper')
            expect(readFileSync(fixture.sudoersFile, 'utf8')).toBe('old sudoers\n')
            expect(readFileSync(fixture.readyMarker, 'utf8')).toBe('old ready marker\n')
        } finally {
            cleanupFixture(fixture)
        }
    })

    test('restores the readiness marker only after reloading restored state', () => {
        const fixture = createFixture()
        try {
            seedInstalledState(fixture)
            const result = runInstaller(fixture, { NGINX_FAIL_CALL: '1' })
            const commands = readFileSync(fixture.commandLog, 'utf8')

            expect(result.status).not.toBe(0)
            expect(readFileSync(fixture.readyMarker, 'utf8')).toBe('old ready marker\n')
            expect(commands).toContain('nginx[1] -t')
            expect(commands).toContain('nginx[2] -t')
            expect(commands).toContain('systemctl[1] reload nginx')
        } finally {
            cleanupFixture(fixture)
        }
    })

    test('restores the prior installation when the first Nginx reload fails', () => {
        const fixture = createFixture()
        try {
            seedInstalledState(fixture)
            const result = runInstaller(fixture, { SYSTEMCTL_FAIL_CALL: '1' })
            const commands = readFileSync(fixture.commandLog, 'utf8')

            expect(result.status).not.toBe(0)
            expect(realpathSync(fixture.activeLink)).toBe(realpathSync(join(fixture.configDir, 'blue.conf')))
            expect(readFileSync(join(fixture.configDir, 'legacy.conf'), 'utf8')).toBe('old legacy\n')
            expect(readFileSync(fixture.readyMarker, 'utf8')).toBe('old ready marker\n')
            expect(commands).toContain('nginx[1] -t')
            expect(commands).toContain('systemctl[1] reload nginx')
            expect(commands).toContain('nginx[2] -t')
            expect(commands).toContain('systemctl[2] reload nginx')
        } finally {
            cleanupFixture(fixture)
        }
    })

    test('refuses an ambiguous legacy proxy_pass without rewriting the site', () => {
        const originalSite = `server {
    proxy_pass http://localhost:1000;
    proxy_pass http://127.0.0.1:1000;
}
`
        const fixture = createFixture(originalSite)
        try {
            const result = runInstaller(fixture)

            expect(result.status).not.toBe(0)
            expect(result.stderr).toContain('exactly one expected legacy configuration')
            expect(readFileSync(fixture.sitePath, 'utf8')).toBe(originalSite)
            expect(readFileSync(fixture.commandLog, 'utf8')).not.toContain('curl ')
        } finally {
            cleanupFixture(fixture)
        }
    })
})

describe('Nginx upstream switch helper', () => {
    test('restores the previous link when nginx -t rejects the candidate', () => {
        const fixture = createFixture()
        try {
            seedSwitchState(fixture)
            const result = runSwitch(fixture, 'green', { NGINX_FAIL_CALL: '1' })

            expect(result.status).not.toBe(0)
            expect(realpathSync(fixture.activeLink)).toBe(realpathSync(join(fixture.configDir, 'blue.conf')))
            expect(readFileSync(fixture.readyMarker, 'utf8')).toBe('ready\n')
            expect(result.stderr).toContain('restored the previous configuration')
            expect(readFileSync(fixture.commandLog, 'utf8')).not.toContain('systemctl')
        } finally {
            cleanupFixture(fixture)
        }
    })

    test('restores and reloads the previous link when systemctl reload fails', () => {
        const fixture = createFixture()
        try {
            seedSwitchState(fixture)
            const result = runSwitch(fixture, 'green', { SYSTEMCTL_FAIL_CALL: '1' })
            const commands = readFileSync(fixture.commandLog, 'utf8')

            expect(result.status).not.toBe(0)
            expect(realpathSync(fixture.activeLink)).toBe(realpathSync(join(fixture.configDir, 'blue.conf')))
            expect(commands).toContain('nginx[1] -t')
            expect(commands).toContain('systemctl[1] reload nginx')
            expect(commands).toContain('nginx[2] -t')
            expect(commands).toContain('systemctl[2] reload nginx')
            expect(result.stderr).toContain('Nginx reload failed')
        } finally {
            cleanupFixture(fixture)
        }
    })

    test('refuses to replace an unknown active symlink', () => {
        const fixture = createFixture()
        try {
            seedSwitchState(fixture)
            rmSync(fixture.activeLink)
            const unknownTarget = rooted(fixture.root, '/etc/nginx/unknown-upstream.conf')
            writeFileSync(unknownTarget, 'unknown\n')
            symlinkSync(unknownTarget, fixture.activeLink)

            const result = runSwitch(fixture, 'green')

            expect(result.status).not.toBe(0)
            expect(realpathSync(fixture.activeLink)).toBe(realpathSync(unknownTarget))
            expect(result.stderr).toContain('refusing to replace an unknown SynthArena upstream link')
            expect(readFileSync(fixture.commandLog, 'utf8')).toBe('')
        } finally {
            cleanupFixture(fixture)
        }
    })
})
