import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, test } from 'vitest'

const repoRoot = resolve(import.meta.dirname, '../..')
const resolver = join(repoRoot, 'scripts/resolve-image-digest.sh')
const revision = '1'.repeat(40)
const image = `ghcr.io/ischemist/syntharena:sha-${revision}`

function runResolver(rawManifest: string) {
    const fixture = mkdtempSync(join(tmpdir(), 'syntharena-image-digest-'))
    const bin = join(fixture, 'bin')
    mkdirSync(bin)
    const docker = join(bin, 'docker')
    writeFileSync(
        docker,
        `#!/usr/bin/env bash
if [ "$*" != "buildx imagetools inspect ${image} --raw" ]; then
    printf 'unexpected docker command: %s\n' "$*" >&2
    exit 1
fi
printf '%s' "$RAW_MANIFEST"
`
    )
    chmodSync(docker, 0o755)

    try {
        return spawnSync('bash', [resolver, image], {
            cwd: repoRoot,
            encoding: 'utf8',
            env: {
                ...process.env,
                PATH: `${bin}:${process.env.PATH}`,
                RAW_MANIFEST: rawManifest,
            },
        })
    } finally {
        rmSync(fixture, { force: true, recursive: true })
    }
}

describe('image digest resolver', () => {
    test('checks out resolver tooling from the running workflow revision so older rollback targets remain deployable', () => {
        const workflow = readFileSync(join(repoRoot, '.github/workflows/deploy-production.yml'), 'utf8')
        const checkout = workflow.indexOf('- name: Checkout deployment tooling from workflow revision')
        const resolverCall = workflow.indexOf('digest="$(./scripts/resolve-image-digest.sh "$image")"')
        const checkoutBlock = workflow.slice(checkout, resolverCall)

        expect(checkout).toBeGreaterThan(-1)
        expect(resolverCall).toBeGreaterThan(checkout)
        expect(checkoutBlock).toContain('ref: ${{ github.workflow_sha }}')
        expect(checkoutBlock).not.toContain('ref: ${{ needs.prepare.outputs.sha }}')
        expect(checkoutBlock).toContain('Rollback targets can predate this helper')
        expect(checkoutBlock).toContain('persist-credentials: false')
    })

    test('hashes the exact raw top-level OCI index bytes', () => {
        const manifest = '{"schemaVersion":2,"mediaType":"application/vnd.oci.image.index.v1+json","manifests":[]}'
        const expected = createHash('sha256').update(manifest).digest('hex')
        const result = runResolver(manifest)

        expect(result.status, result.stderr).toBe(0)
        expect(result.stdout).toBe(`sha256:${expected}\n`)
    })

    test('rejects empty registry output instead of accepting the empty-content hash', () => {
        const result = runResolver('')

        expect(result.status).not.toBe(0)
        expect(result.stderr).toContain('empty top-level image manifest')
    })
})
