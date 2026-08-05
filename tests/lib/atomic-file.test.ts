import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, it } from 'vitest'

import { promoteFileNoReplace } from '@/lib/atomic-file'

const directories: string[] = []

afterEach(async () => {
    await Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })))
})

describe('promoteFileNoReplace', () => {
    it('publishes the partial file and removes its temporary name', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'syntharena-promote-'))
        directories.push(directory)
        const partial = path.join(directory, 'database.partial')
        const output = path.join(directory, 'database.db')
        await fs.writeFile(partial, 'complete database')

        await promoteFileNoReplace(partial, output)

        await expect(fs.readFile(output, 'utf8')).resolves.toBe('complete database')
        await expect(fs.access(partial)).rejects.toMatchObject({ code: 'ENOENT' })
    })

    it('never overwrites a destination created after reservation', async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'syntharena-promote-race-'))
        directories.push(directory)
        const partial = path.join(directory, 'database.partial')
        const output = path.join(directory, 'database.db')
        await fs.writeFile(partial, 'new database')
        await fs.writeFile(output, 'concurrent owner')

        await expect(promoteFileNoReplace(partial, output)).rejects.toMatchObject({ code: 'EEXIST' })
        await expect(fs.readFile(output, 'utf8')).resolves.toBe('concurrent owner')
        await expect(fs.readFile(partial, 'utf8')).resolves.toBe('new database')
    })
})
