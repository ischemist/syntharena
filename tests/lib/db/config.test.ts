import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, test } from 'vitest'

import { databaseAdapterConfig } from '@/lib/db/config'

describe('production database configuration', () => {
    test('opens the existing corpus read-only when the production flag is enabled', () => {
        expect(
            databaseAdapterConfig({
                DATABASE_URL: 'file:/app/data/prod.db',
                SYNTHARENA_DATABASE_READONLY: 'true',
            })
        ).toEqual({
            url: 'file:/app/data/prod.db',
            readonly: true,
            fileMustExist: true,
        })
    })

    test('keeps development and migration connections writable by default', () => {
        expect(databaseAdapterConfig({ DATABASE_URL: 'file:./prisma/dev.db' })).toEqual({
            url: 'file:./prisma/dev.db',
            readonly: false,
            fileMustExist: false,
        })
    })

    test('rejects ambiguous read-only configuration', () => {
        expect(() =>
            databaseAdapterConfig({
                DATABASE_URL: 'file:/app/data/prod.db',
                SYNTHARENA_DATABASE_READONLY: '1',
            })
        ).toThrow('SYNTHARENA_DATABASE_READONLY must be either true or false')
    })

    test('mounts app slots read-only while leaving the migration tool writable', () => {
        const compose = readFileSync(resolve(import.meta.dirname, '../../../docker-compose.yml'), 'utf8')
        const appService = compose.slice(0, compose.indexOf('\nservices:'))
        const migrateService = compose.slice(compose.indexOf('    migrate:'), compose.indexOf('    app-blue:'))

        expect(appService).toContain("SYNTHARENA_DATABASE_READONLY: 'true'")
        expect(appService).toContain('read_only: true')
        expect(migrateService).not.toContain('read_only: true')
        expect(migrateService).not.toContain('SYNTHARENA_DATABASE_READONLY')
    })
})
