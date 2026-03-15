/**
 * Integration tests for stock-loader.service.ts
 *
 * Tests stock loading from CSV files, molecule deduplication,
 * and metadata update operations against a real SQLite test database.
 */

import { afterEach, describe, expect, it } from 'vitest'

import prisma from '@/lib/db'
import {
    batchUpdateStockItemMetadata,
    getStockByName,
    loadStockFromFile,
    updateStockItemMetadata,
} from '@/lib/services/loaders/stock-loader.service'

import { carbonChainSmiles, cleanupTempFiles, createTestCsvFile, syntheticInchiKey } from '../../../helpers/factories'

afterEach(() => {
    cleanupTempFiles()
})

// ============================================================================
// loadStockFromFile
// ============================================================================

describe('loadStockFromFile', () => {
    it('creates stock, molecules, and stock items from a CSV file', async () => {
        const molecules = [
            { smiles: carbonChainSmiles(1), inchikey: syntheticInchiKey('C') },
            { smiles: carbonChainSmiles(2), inchikey: syntheticInchiKey('CC') },
            { smiles: carbonChainSmiles(3), inchikey: syntheticInchiKey('CCC') },
        ]
        const csvPath = createTestCsvFile(molecules)

        const result = await loadStockFromFile(csvPath, 'test-stock-basic')

        expect(result.moleculesCreated).toBe(3)
        expect(result.moleculesSkipped).toBe(0)
        expect(result.itemsCreated).toBe(3)

        // Verify stock exists in DB
        const stock = await prisma.stock.findUnique({ where: { id: result.stockId } })
        expect(stock).not.toBeNull()
        expect(stock!.name).toBe('test-stock-basic')

        // Verify molecules exist
        const dbMolecules = await prisma.molecule.findMany()
        expect(dbMolecules).toHaveLength(3)

        // Verify stock items link molecules to stock
        const items = await prisma.stockItem.findMany({ where: { stockId: result.stockId } })
        expect(items).toHaveLength(3)
    })

    it('deduplicates molecules by inchikey across stocks', async () => {
        const sharedMolecules = [
            { smiles: carbonChainSmiles(1), inchikey: syntheticInchiKey('C') },
            { smiles: carbonChainSmiles(2), inchikey: syntheticInchiKey('CC') },
        ]
        const csv1 = createTestCsvFile(sharedMolecules)
        const csv2 = createTestCsvFile(sharedMolecules)

        const result1 = await loadStockFromFile(csv1, 'stock-alpha')
        const result2 = await loadStockFromFile(csv2, 'stock-beta')

        // First stock creates all molecules
        expect(result1.moleculesCreated).toBe(2)
        expect(result1.moleculesSkipped).toBe(0)

        // Second stock reuses existing molecules
        expect(result2.moleculesCreated).toBe(0)
        expect(result2.moleculesSkipped).toBe(2)

        // Only 2 molecule records exist globally
        const allMolecules = await prisma.molecule.findMany()
        expect(allMolecules).toHaveLength(2)

        // But each stock has its own stock items
        const items1 = await prisma.stockItem.findMany({ where: { stockId: result1.stockId } })
        const items2 = await prisma.stockItem.findMany({ where: { stockId: result2.stockId } })
        expect(items1).toHaveLength(2)
        expect(items2).toHaveLength(2)
    })

    it('throws on duplicate stock name', async () => {
        const molecules = [{ smiles: 'C', inchikey: syntheticInchiKey('C') }]
        const csv1 = createTestCsvFile(molecules)
        const csv2 = createTestCsvFile(molecules)

        await loadStockFromFile(csv1, 'duplicate-name')

        await expect(loadStockFromFile(csv2, 'duplicate-name')).rejects.toThrow('already exists')
    })

    it('throws on missing header', async () => {
        const csvPath = createTestCsvFile([], { header: 'col1,col2' })

        await expect(loadStockFromFile(csvPath, 'bad-header')).rejects.toThrow('header')
    })

    it('throws on empty file (no data rows)', async () => {
        const csvPath = createTestCsvFile([])

        await expect(loadStockFromFile(csvPath, 'empty-stock')).rejects.toThrow('at least a header and one data row')
    })

    it('throws on nonexistent file', async () => {
        await expect(loadStockFromFile('/nonexistent/path.csv', 'ghost')).rejects.toThrow('File not found')
    })

    it('skips invalid rows and loads valid ones', async () => {
        const validMolecules = [
            { smiles: carbonChainSmiles(1), inchikey: syntheticInchiKey('C') },
            { smiles: carbonChainSmiles(2), inchikey: syntheticInchiKey('CC') },
        ]
        // Add rows with missing fields
        const csvPath = createTestCsvFile(validMolecules, {
            extraLines: [
                'no-comma-here', // Missing comma
                ',empty-smiles', // Empty SMILES
                'empty-inchikey,', // Empty InChiKey
            ],
        })

        const result = await loadStockFromFile(csvPath, 'partial-stock')

        expect(result.moleculesCreated).toBe(2)
        expect(result.itemsCreated).toBe(2)
    })

    it('handles stock with description', async () => {
        const molecules = [{ smiles: 'C', inchikey: syntheticInchiKey('C') }]
        const csvPath = createTestCsvFile(molecules)

        const result = await loadStockFromFile(csvPath, 'described-stock', 'A nice description')

        const stock = await prisma.stock.findUnique({ where: { id: result.stockId } })
        expect(stock!.description).toBe('A nice description')
    })
})

// ============================================================================
// getStockByName
// ============================================================================

describe('getStockByName', () => {
    it('finds stock with case-insensitive match', async () => {
        const molecules = [{ smiles: 'C', inchikey: syntheticInchiKey('C') }]
        const csvPath = createTestCsvFile(molecules)
        await loadStockFromFile(csvPath, 'MyTestStock')

        const found = await getStockByName('myteststock')
        expect(found).not.toBeNull()
        expect(found!.name).toBe('MyTestStock')
    })

    it('returns null for nonexistent stock', async () => {
        const found = await getStockByName('does-not-exist')
        expect(found).toBeNull()
    })

    it('returns correct itemCount', async () => {
        const molecules = [
            { smiles: carbonChainSmiles(1), inchikey: syntheticInchiKey('C') },
            { smiles: carbonChainSmiles(2), inchikey: syntheticInchiKey('CC') },
            { smiles: carbonChainSmiles(3), inchikey: syntheticInchiKey('CCC') },
        ]
        const csvPath = createTestCsvFile(molecules)
        await loadStockFromFile(csvPath, 'counted-stock')

        const found = await getStockByName('counted-stock')
        expect(found!.itemCount).toBe(3)
    })
})

// ============================================================================
// updateStockItemMetadata
// ============================================================================

describe('updateStockItemMetadata', () => {
    it('updates ppg, source, leadTime, and link', async () => {
        const molecules = [{ smiles: 'C', inchikey: syntheticInchiKey('C') }]
        const csvPath = createTestCsvFile(molecules)
        const { stockId } = await loadStockFromFile(csvPath, 'meta-stock')

        const result = await updateStockItemMetadata(stockId, syntheticInchiKey('C'), {
            ppg: 42.5,
            source: 'MC',
            leadTime: '7-14 days',
            link: 'https://example.com/mol',
        })

        expect(result).not.toBeNull()

        // Verify in DB
        const item = await prisma.stockItem.findFirst({
            where: { stockId },
        })
        expect(item!.ppg).toBe(42.5)
        expect(item!.source).toBe('MC')
        expect(item!.leadTime).toBe('7-14 days')
        expect(item!.link).toBe('https://example.com/mol')
    })

    it('returns null for unknown inchikey', async () => {
        const molecules = [{ smiles: 'C', inchikey: syntheticInchiKey('C') }]
        const csvPath = createTestCsvFile(molecules)
        const { stockId } = await loadStockFromFile(csvPath, 'meta-stock-miss')

        const result = await updateStockItemMetadata(stockId, 'NONEXISTENT-INCHIKEY-N', {
            ppg: 10,
        })

        expect(result).toBeNull()
    })
})

// ============================================================================
// batchUpdateStockItemMetadata
// ============================================================================

describe('batchUpdateStockItemMetadata', () => {
    it('updates multiple items and counts correctly', async () => {
        const molecules = [
            { smiles: carbonChainSmiles(1), inchikey: syntheticInchiKey('C') },
            { smiles: carbonChainSmiles(2), inchikey: syntheticInchiKey('CC') },
            { smiles: carbonChainSmiles(3), inchikey: syntheticInchiKey('CCC') },
        ]
        const csvPath = createTestCsvFile(molecules)
        const { stockId } = await loadStockFromFile(csvPath, 'batch-meta-stock')

        const result = await batchUpdateStockItemMetadata(stockId, [
            { inchikey: syntheticInchiKey('C'), ppg: 10 },
            { inchikey: syntheticInchiKey('CC'), ppg: 20, source: 'SA' },
            { inchikey: syntheticInchiKey('CCC'), ppg: 30 },
        ])

        expect(result.updated).toBe(3)
        expect(result.notFound).toBe(0)

        // Verify in DB
        const mol1 = await prisma.molecule.findUnique({ where: { inchikey: syntheticInchiKey('C') } })
        const item1 = await prisma.stockItem.findUnique({
            where: { stockId_moleculeId: { stockId, moleculeId: mol1!.id } },
        })
        expect(item1!.ppg).toBe(10)

        const mol2 = await prisma.molecule.findUnique({ where: { inchikey: syntheticInchiKey('CC') } })
        const item2 = await prisma.stockItem.findUnique({
            where: { stockId_moleculeId: { stockId, moleculeId: mol2!.id } },
        })
        expect(item2!.ppg).toBe(20)
        expect(item2!.source).toBe('SA')
    })

    it('counts notFound correctly for missing inchikeys', async () => {
        const molecules = [{ smiles: carbonChainSmiles(1), inchikey: syntheticInchiKey('C') }]
        const csvPath = createTestCsvFile(molecules)
        const { stockId } = await loadStockFromFile(csvPath, 'batch-meta-miss')

        const result = await batchUpdateStockItemMetadata(stockId, [
            { inchikey: syntheticInchiKey('C'), ppg: 10 },
            { inchikey: 'MISSING-KEY-0000000-N', ppg: 99 },
            { inchikey: 'ANOTHER-MISSING-KEY-N', ppg: 99 },
        ])

        expect(result.updated).toBe(1)
        expect(result.notFound).toBe(2)
    })
})
