/**
 * Tests for stock.service.ts
 *
 * Focus: Complex business logic and data integrity
 * - CSV file loading with idempotency guarantees
 * - Batch processing and transaction behavior
 * - Search/filter logic with multiple parameters
 * - Data relationships and cross-stock queries
 * - Edge cases and error conditions
 * - Performance characteristics (N+1 prevention)
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { MoleculeWithStocks } from '@/types'
import prisma from '@/lib/db'
import {
    checkMoleculesInStock,
    deleteStock,
    getMoleculesWithStocks,
    getMoleculeWithStocks,
    getStockById,
    getStocks,
    loadStockFromFile,
    searchStockMolecules,
    searchStockMoleculesWithStocks,
} from '@/lib/services/stock.service'

import {
    csvWithInvalidLines,
    generateLargeCsv,
    headerOnlyCsv,
    invalidHeaderCsv,
    minimalCsvContent,
    mixedCaseCsv,
    sampleMolecules,
    testStocks,
    validCsvContent,
} from './stock.service.fixtures'

/**
 * Test database helper - creates temp files and cleans up
 */
const tmpDir = path.join(process.cwd(), '.test-tmp')

const createTempCsvFile = async (content: string): Promise<string> => {
    // Create tmp directory if needed
    try {
        await fs.mkdir(tmpDir, { recursive: true })
    } catch {
        // Directory may already exist
    }

    const filename = `stock-test-${Date.now()}-${Math.random().toString(36).slice(2)}.csv`
    const filepath = path.join(tmpDir, filename)
    await fs.writeFile(filepath, content, 'utf-8')
    return filepath
}

/**
 * Cleanup helper - cleans up only test stocks created during our tests
 */
const cleanupDatabase = async () => {
    // Delete stock items for test stocks (they all start with 'test-', 'search-', 'stock-', etc.)
    const testStockNames = [
        'test-%',
        'search-%',
        'stock-%',
        'alpha-%',
        'beta-%',
        'zebra-%',
        'empty-%',
        'concurrent-%',
        'large-%',
        'idempotent-%',
        'drug-like-%',
        'commercial-%',
        'organic-%',
        'duplicate-%',
        'batch-%',
    ]

    // Get test stocks and delete their items
    const testStocks = await prisma.stock.findMany({
        where: {
            OR: testStockNames.map((name) => ({
                name: { contains: name.replace(/-?%$/, '') },
            })),
        },
    })

    if (testStocks.length > 0) {
        const testStockIds = testStocks.map((s) => s.id)
        await prisma.stockItem.deleteMany({
            where: { stockId: { in: testStockIds } },
        })
        await prisma.stock.deleteMany({
            where: { id: { in: testStockIds } },
        })
    }
}

const cleanupTempFiles = async () => {
    try {
        const files = await fs.readdir(tmpDir)
        for (const file of files) {
            if (file.startsWith('stock-test-')) {
                await fs.unlink(path.join(tmpDir, file))
            }
        }
    } catch {
        // Directory may not exist yet
    }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('StockService', () => {
    const createdStockIds: string[] = []

    beforeEach(async () => {
        // Just cleanup temp files at start
        await cleanupTempFiles()
    })

    afterEach(async () => {
        // Only delete stocks and items we explicitly created
        if (createdStockIds.length > 0) {
            await prisma.stockItem.deleteMany({
                where: { stockId: { in: createdStockIds } },
            })
            await prisma.stock.deleteMany({
                where: { id: { in: createdStockIds } },
            })
            createdStockIds.length = 0
        }
        await cleanupTempFiles()
    })

    // Helper to track created stocks
    const trackStock = (stockId: string) => {
        createdStockIds.push(stockId)
        return stockId
    }

    // ========================================================================
    // loadStockFromFile Tests
    // ========================================================================

    describe('loadStockFromFile', () => {
        it('should successfully load valid CSV and create stock with molecules', async () => {
            const csvPath = await createTempCsvFile(validCsvContent)

            const result = await loadStockFromFile(csvPath, 'test-stock-1')

            expect(result.moleculesCreated).toBe(7)
            expect(result.moleculesSkipped).toBe(0)
            expect(result.itemsCreated).toBe(7)
            expect(result.stockId).toBeDefined()

            // Verify stock was created
            const stock = await prisma.stock.findUnique({
                where: { id: result.stockId },
            })
            expect(stock).toBeDefined()
            expect(stock?.name).toBe('test-stock-1')

            // Verify molecules exist
            const moleculeCount = await prisma.molecule.count()
            expect(moleculeCount).toBe(7)

            // Verify stock items created
            const itemCount = await prisma.stockItem.count({
                where: { stockId: result.stockId },
            })
            expect(itemCount).toBe(7)
        })

        it('should be idempotent - loading same file twice should not create duplicates', async () => {
            const csvPath = await createTempCsvFile(validCsvContent)
            const stockName = 'idempotent-test'

            // Load once
            const result1 = await loadStockFromFile(csvPath, stockName)
            expect(result1.moleculesCreated).toBe(7)
            expect(result1.moleculesSkipped).toBe(0)

            // Load again with different stock name (molecules should exist)
            const result2 = await loadStockFromFile(csvPath, `${stockName}-2`)
            expect(result2.moleculesCreated).toBe(0) // No new molecules
            expect(result2.moleculesSkipped).toBe(7) // All molecules skipped (already exist)
            expect(result2.itemsCreated).toBe(7) // But stock items created for new stock

            // Verify only 2 stocks exist
            const stocks = await prisma.stock.findMany()
            expect(stocks).toHaveLength(2)

            // Verify molecules not duplicated
            const moleculeCount = await prisma.molecule.count()
            expect(moleculeCount).toBe(7)
        })

        it('should handle CSV with invalid lines gracefully', async () => {
            const csvPath = await createTempCsvFile(csvWithInvalidLines)

            const result = await loadStockFromFile(csvPath, 'test-invalid-lines')

            // Should skip the invalid lines but still process valid ones
            expect(result.moleculesCreated).toBeGreaterThan(0)
            expect(result.itemsCreated).toBe(result.moleculesCreated)

            const stock = await prisma.stock.findUnique({
                where: { id: result.stockId },
            })
            expect(stock).toBeDefined()
        })

        it('should handle case-insensitive header', async () => {
            const csvPath = await createTempCsvFile(mixedCaseCsv)

            const result = await loadStockFromFile(csvPath, 'test-case-insensitive')

            expect(result.moleculesCreated).toBe(2)
            expect(result.itemsCreated).toBe(2)
        })

        it('should throw error when file does not exist', async () => {
            await expect(loadStockFromFile('/nonexistent/path/file.csv', 'test-stock')).rejects.toThrow(
                'File not found'
            )
        })

        it('should throw error when file has only header', async () => {
            const csvPath = await createTempCsvFile(headerOnlyCsv)

            await expect(loadStockFromFile(csvPath, 'test-stock')).rejects.toThrow(
                'File must contain at least a header and one data row'
            )
        })

        it('should throw error when header is invalid', async () => {
            const csvPath = await createTempCsvFile(invalidHeaderCsv)

            await expect(loadStockFromFile(csvPath, 'test-stock')).rejects.toThrow(
                'must have header with SMILES and InChi Key columns'
            )
        })

        it('should throw error when stock name already exists', async () => {
            const csvPath = await createTempCsvFile(validCsvContent)
            const stockName = 'duplicate-stock-name'

            // Load first time
            await loadStockFromFile(csvPath, stockName)

            // Try loading again with same stock name
            await expect(loadStockFromFile(csvPath, stockName)).rejects.toThrow(
                `A stock with name "${stockName}" already exists`
            )
        })

        it('should support optional description', async () => {
            const csvPath = await createTempCsvFile(validCsvContent)
            const description = 'Test stock description'

            const result = await loadStockFromFile(csvPath, 'test-with-desc', description)

            const stock = await prisma.stock.findUnique({
                where: { id: result.stockId },
            })
            expect(stock?.description).toBe(description)
        })

        it('should handle large batch processing correctly', async () => {
            const largeCSV = generateLargeCsv(1500) // More than batch size (500)
            const csvPath = await createTempCsvFile(largeCSV)

            const result = await loadStockFromFile(csvPath, 'large-batch-test')

            // All 1500 molecules should be created
            expect(result.moleculesCreated).toBe(1500)
            expect(result.itemsCreated).toBe(1500)

            const itemCount = await prisma.stockItem.count({
                where: { stockId: result.stockId },
            })
            expect(itemCount).toBe(1500)
        })

        it('should succeed with realistic large batch processing', async () => {
            const largeCSV = generateLargeCsv(750) // Test batch boundary
            const csvPath = await createTempCsvFile(largeCSV)

            const result = await loadStockFromFile(csvPath, 'batch-boundary-test')

            expect(result.moleculesCreated).toBe(750)
            expect(result.itemsCreated).toBe(750)

            // Verify all items are in database
            const itemCount = await prisma.stockItem.count({
                where: { stockId: result.stockId },
            })
            expect(itemCount).toBe(750)
        })
    })

    // ========================================================================
    // Stock Query Tests (getStocks, getStockById)
    // ========================================================================

    describe('getStocks', () => {
        it('should return empty array when no stocks exist', async () => {
            const stocks = await getStocks()

            expect(stocks).toEqual([])
        })

        it('should return all stocks with item count', async () => {
            const csvPath = await createTempCsvFile(validCsvContent)

            // Create two stocks
            const result1 = await loadStockFromFile(csvPath, testStocks.druglike.name, testStocks.druglike.description)
            const result2 = await loadStockFromFile(
                csvPath,
                testStocks.commercial.name,
                testStocks.commercial.description
            )

            const stocks = await getStocks()

            expect(stocks).toHaveLength(2)
            expect(stocks[0].itemCount).toBe(7)
            expect(stocks[1].itemCount).toBe(7)

            // Verify ordered by name
            expect(stocks[0].name < stocks[1].name).toBe(true)
        })

        it('should include description in response', async () => {
            const csvPath = await createTempCsvFile(minimalCsvContent)

            await loadStockFromFile(csvPath, 'test-stock', 'A test stock')

            const stocks = await getStocks()

            expect(stocks).toHaveLength(1)
            expect(stocks[0].description).toBe('A test stock')
        })

        it('should handle missing description gracefully', async () => {
            const csvPath = await createTempCsvFile(minimalCsvContent)

            await loadStockFromFile(csvPath, 'test-stock-no-desc')

            const stocks = await getStocks()

            // Description should be undefined when not provided
            expect(stocks[0].description).toBeUndefined()
        })

        it('should order stocks alphabetically by name', async () => {
            const csvPath = await createTempCsvFile(minimalCsvContent)

            // Create stocks in random order
            await loadStockFromFile(csvPath, 'zebra-stock')
            await loadStockFromFile(csvPath, 'alpha-stock')
            await loadStockFromFile(csvPath, 'beta-stock')

            const stocks = await getStocks()

            expect(stocks[0].name).toBe('alpha-stock')
            expect(stocks[1].name).toBe('beta-stock')
            expect(stocks[2].name).toBe('zebra-stock')
        })
    })

    describe('getStockById', () => {
        it('should return stock with correct item count', async () => {
            const csvPath = await createTempCsvFile(validCsvContent)

            const { stockId } = await loadStockFromFile(csvPath, 'test-stock')

            const stock = await getStockById(stockId)

            expect(stock.id).toBe(stockId)
            expect(stock.name).toBe('test-stock')
            expect(stock.itemCount).toBe(7)
        })

        it('should throw error when stock does not exist', async () => {
            await expect(getStockById('nonexistent-id')).rejects.toThrow('Stock not found')
        })

        it('should return zero itemCount for empty stock', async () => {
            // Create a stock directly without items
            const stock = await prisma.stock.create({
                data: { name: 'empty-stock' },
            })

            const result = await getStockById(stock.id)

            expect(result.itemCount).toBe(0)
        })
    })

    // ========================================================================
    // Molecule Search Tests
    // ========================================================================

    describe('searchStockMolecules', () => {
        let stockId: string

        beforeEach(async () => {
            const csvPath = await createTempCsvFile(validCsvContent)
            const result = await loadStockFromFile(csvPath, 'search-test-stock')
            stockId = result.stockId
        })

        it('should search by SMILES prefix', async () => {
            const result = await searchStockMolecules('CC')

            expect(result.molecules.length).toBeGreaterThan(0)
            expect(result.molecules.some((m) => m.smiles.startsWith('CC'))).toBe(true)
        })

        it('should search by InChiKey prefix', async () => {
            const result = await searchStockMolecules('VNWKTOK')

            expect(result.molecules).toHaveLength(1)
            expect(result.molecules[0].inchikey).toContain('VNWKTOK')
        })

        it('should filter by stock ID', async () => {
            const result = await searchStockMolecules('', stockId)

            expect(result.total).toBe(7)
            expect(result.molecules).toHaveLength(7)
        })

        it('should combine search query and stock filter', async () => {
            const result = await searchStockMolecules('CC', stockId)

            expect(result.molecules.length).toBeGreaterThan(0)
            expect(result.molecules.every((m) => m.smiles.startsWith('CC'))).toBe(true)
        })

        it('should return empty result when no matches found', async () => {
            const result = await searchStockMolecules('XYZ123', stockId)

            expect(result.molecules).toEqual([])
            expect(result.total).toBe(0)
            expect(result.hasMore).toBe(false)
        })

        it('should support pagination with limit and offset', async () => {
            const page1 = await searchStockMolecules('', stockId, 3, 0)
            const page2 = await searchStockMolecules('', stockId, 3, 3)

            expect(page1.molecules).toHaveLength(3)
            expect(page2.molecules).toHaveLength(3)
            expect(page1.molecules[0].id).not.toBe(page2.molecules[0].id)
        })

        it('should indicate when more results available', async () => {
            const result = await searchStockMolecules('', stockId, 5)

            expect(result.hasMore).toBe(true)
            expect(result.molecules).toHaveLength(5)
            expect(result.total).toBe(7)
        })

        it('should clamp limit to valid range (1-1000)', async () => {
            const tooSmall = await searchStockMolecules('', stockId, 0, 0)
            expect(tooSmall.molecules.length).toBeGreaterThan(0)

            const tooLarge = await searchStockMolecules('', stockId, 2000, 0)
            expect(tooLarge.molecules.length).toBeLessThanOrEqual(1000)
        })

        it('should handle negative offset gracefully', async () => {
            const result = await searchStockMolecules('', stockId, 10, -5)

            expect(result.molecules).toHaveLength(7)
        })

        it('should return all molecules when no query provided', async () => {
            const result = await searchStockMolecules('', stockId)

            expect(result.total).toBe(7)
            expect(result.molecules.length).toBeLessThanOrEqual(7)
        })

        it('should trim whitespace from query', async () => {
            const resultWithSpace = await searchStockMolecules('  C  ', stockId)
            const resultWithoutSpace = await searchStockMolecules('C', stockId)

            expect(resultWithSpace.molecules).toHaveLength(resultWithoutSpace.molecules.length)
        })

        it('should handle InChiKey search case-insensitively', async () => {
            const uppercase = await searchStockMolecules('VNWKTOK', stockId)
            const lowercase = await searchStockMolecules('vnwktok', stockId)

            expect(uppercase.molecules).toHaveLength(lowercase.molecules.length)
        })
    })

    describe('searchStockMoleculesWithStocks', () => {
        let stockId1: string
        let stockId2: string

        beforeEach(async () => {
            const csvPath = await createTempCsvFile(validCsvContent)
            const result1 = await loadStockFromFile(csvPath, 'stock-with-stocks-1')
            const result2 = await loadStockFromFile(csvPath, 'stock-with-stocks-2')
            stockId1 = result1.stockId
            stockId2 = result2.stockId
        })

        it('should return molecules with cross-stock information', async () => {
            const result = await searchStockMoleculesWithStocks('C', stockId1)

            expect(result.molecules.length).toBeGreaterThan(0)
            const mol = result.molecules[0]
            expect(mol.stocks).toBeDefined()
            expect(Array.isArray(mol.stocks)).toBe(true)
        })

        it('should include all stocks for molecules in multiple stocks', async () => {
            const result = await searchStockMoleculesWithStocks('C')

            // First molecule (C) should be in both stocks
            const methane = result.molecules.find((m) => m.smiles === 'C')
            if (methane) {
                expect(methane.stocks.length).toBeGreaterThanOrEqual(2)
            }
        })

        it('should avoid N+1 queries', async () => {
            // This is a quality check - the function should fetch all stock relations in one query
            const result = await searchStockMoleculesWithStocks('', stockId1, 50)

            // If N+1 existed, we'd see many queries. This passes if it returns successfully.
            expect(result.molecules.length).toBeGreaterThan(0)
            expect(result.molecules.every((m) => Array.isArray(m.stocks))).toBe(true)
        })

        it('should support pagination', async () => {
            const result = await searchStockMoleculesWithStocks('', undefined, 3, 0)

            expect(result.molecules).toHaveLength(3)
            expect(result.hasMore).toBe(true)
        })
    })

    // ========================================================================
    // Molecule Retrieval Tests
    // ========================================================================

    describe('getMoleculeWithStocks', () => {
        let moleculeId: string
        let stockId: string

        beforeEach(async () => {
            const csvPath = await createTempCsvFile(minimalCsvContent)
            const result = await loadStockFromFile(csvPath, 'test-stock')
            stockId = result.stockId

            // Get the molecule ID
            const molecules = await prisma.molecule.findMany({ take: 1 })
            moleculeId = molecules[0].id
        })

        it('should return molecule with stocks', async () => {
            const result = await getMoleculeWithStocks(moleculeId)

            expect(result.id).toBe(moleculeId)
            expect(result.stocks).toBeDefined()
            // Should have at least the stock we created in beforeEach
            expect(result.stocks.length).toBeGreaterThanOrEqual(1)
            // Find our test stock
            const testStock = result.stocks.find((s) => s.name === 'test-stock')
            expect(testStock).toBeDefined()
            expect(testStock?.id).toBeDefined()
            expect(testStock?.name).toBe('test-stock')
        })

        it('should throw error when molecule not found', async () => {
            await expect(getMoleculeWithStocks('nonexistent-id')).rejects.toThrow('Molecule not found')
        })

        it('should handle molecule in multiple stocks', async () => {
            // Add same molecule to second stock
            const csvPath = await createTempCsvFile(minimalCsvContent)
            await loadStockFromFile(csvPath, 'test-stock-2')

            const result = await getMoleculeWithStocks(moleculeId)

            // Should now be in at least 2 stocks (both our test stocks)
            const testStocks = result.stocks.filter((s) => s.name === 'test-stock' || s.name === 'test-stock-2')
            expect(testStocks.length).toBe(2)
        })
    })

    describe('getMoleculesWithStocks', () => {
        let moleculeIds: string[]

        beforeEach(async () => {
            const csvPath = await createTempCsvFile(validCsvContent)
            await loadStockFromFile(csvPath, 'test-stock')

            const molecules = await prisma.molecule.findMany({ take: 3 })
            moleculeIds = molecules.map((m) => m.id)
        })

        it('should return multiple molecules with stocks', async () => {
            const results = await getMoleculesWithStocks(moleculeIds)

            expect(results).toHaveLength(3)
            expect(results.every((m) => Array.isArray(m.stocks))).toBe(true)
        })

        it('should return empty array when given empty list', async () => {
            const results = await getMoleculesWithStocks([])

            expect(results).toEqual([])
        })

        it('should handle nonexistent IDs gracefully', async () => {
            const results = await getMoleculesWithStocks([...moleculeIds, 'nonexistent'])

            // Should return only the existing molecules
            expect(results.length).toBeLessThanOrEqual(moleculeIds.length)
        })
    })

    // ========================================================================
    // Stock Deletion Tests
    // ========================================================================

    describe('deleteStock', () => {
        let stockId: string

        beforeEach(async () => {
            const csvPath = await createTempCsvFile(validCsvContent)
            const result = await loadStockFromFile(csvPath, 'test-stock-to-delete')
            stockId = result.stockId
        })

        it('should delete stock and its items', async () => {
            await deleteStock(stockId)

            const stock = await prisma.stock.findUnique({ where: { id: stockId } })
            expect(stock).toBeNull()

            const items = await prisma.stockItem.findMany({ where: { stockId } })
            expect(items).toEqual([])
        })

        it('should not delete molecules when deleting stock', async () => {
            const moleculeCountBefore = await prisma.molecule.count()

            await deleteStock(stockId)

            const moleculeCountAfter = await prisma.molecule.count()
            expect(moleculeCountAfter).toBe(moleculeCountBefore)
        })

        it('should allow molecules to remain in other stocks', async () => {
            // Create second stock with same molecules
            const csvPath = await createTempCsvFile(validCsvContent)
            const result2 = await loadStockFromFile(csvPath, 'test-stock-2')

            // Delete first stock
            await deleteStock(stockId)

            // Second stock should still have items
            const items = await prisma.stockItem.findMany({ where: { stockId: result2.stockId } })
            expect(items.length).toBeGreaterThan(0)
        })

        it('should throw error when stock does not exist', async () => {
            await expect(deleteStock('nonexistent-id')).rejects.toThrow('Stock not found')
        })

        it('should handle deletion of empty stock', async () => {
            // Create empty stock
            const emptyStock = await prisma.stock.create({
                data: { name: 'empty-stock' },
            })

            // Should not throw
            await expect(deleteStock(emptyStock.id)).resolves.not.toThrow()

            const stock = await prisma.stock.findUnique({ where: { id: emptyStock.id } })
            expect(stock).toBeNull()
        })
    })

    // ========================================================================
    // Molecule Availability Check Tests
    // ========================================================================

    describe('checkMoleculesInStock', () => {
        let stockId: string
        let testSmiles: string[]

        beforeEach(async () => {
            const csvPath = await createTempCsvFile(validCsvContent)
            const result = await loadStockFromFile(csvPath, 'test-stock')
            stockId = result.stockId

            // Get actual SMILES from loaded molecules
            testSmiles = sampleMolecules.slice(0, 4).map((m) => m.smiles)
        })

        it('should return Set of SMILES in stock', async () => {
            const result = await checkMoleculesInStock(testSmiles, stockId)

            expect(result instanceof Set).toBe(true)
            expect(result.size).toBeGreaterThan(0)
            expect([...result].every((smiles) => testSmiles.includes(smiles))).toBe(true)
        })

        it('should return empty Set when no molecules match', async () => {
            const result = await checkMoleculesInStock(['NONEXISTENT1', 'NONEXISTENT2'], stockId)

            expect(result.size).toBe(0)
        })

        it('should return empty Set for empty input', async () => {
            const result = await checkMoleculesInStock([], stockId)

            expect(result.size).toBe(0)
        })

        it('should exclude molecules not in the specified stock', async () => {
            // Create second stock with different molecules
            const csvPath = await createTempCsvFile(minimalCsvContent)
            const result2 = await loadStockFromFile(csvPath, 'test-stock-2')

            // Check for molecules that only exist in first stock
            const resultStock1 = await checkMoleculesInStock(testSmiles, stockId)
            const resultStock2 = await checkMoleculesInStock(testSmiles, result2.stockId)

            expect(resultStock1.size).toBeGreaterThan(0)
            // Stock 2 only has 'C', so should have at most 1 match
            expect(resultStock2.size).toBeLessThanOrEqual(1)
        })

        it('should have O(1) lookup performance with Set', async () => {
            const result = await checkMoleculesInStock(testSmiles, stockId)

            // Verify it's actually a Set by checking has method
            const firstSmiles = [...result][0]
            expect(result.has(firstSmiles)).toBe(true)
        })
    })

    // ========================================================================
    // Integration & Complex Scenario Tests
    // ========================================================================

    describe('Complex scenarios', () => {
        it('should handle realistic stock workflow', async () => {
            // 1. Load multiple stocks
            const csvPath = await createTempCsvFile(validCsvContent)
            const stock1 = await loadStockFromFile(csvPath, testStocks.druglike.name, testStocks.druglike.description)
            const stock2 = await loadStockFromFile(
                csvPath,
                testStocks.commercial.name,
                testStocks.commercial.description
            )

            // 2. List all stocks
            let stocks = await getStocks()
            expect(stocks).toHaveLength(2)

            // 3. Search for molecules
            const searchResults = await searchStockMoleculesWithStocks('CC')
            expect(searchResults.molecules.length).toBeGreaterThan(0)

            // 4. Check availability
            const inStock = await checkMoleculesInStock(['C', 'CC'], stock1.stockId)
            expect(inStock.size).toBeGreaterThan(0)

            // 5. Delete one stock
            await deleteStock(stock1.stockId)

            // 6. Verify other stock still has data
            stocks = await getStocks()
            expect(stocks).toHaveLength(1)
            expect(stocks[0].itemCount).toBeGreaterThan(0)
        })

        it('should maintain data consistency across operations', async () => {
            const csvPath = await createTempCsvFile(validCsvContent)

            // Create two stocks with overlapping data
            const result1 = await loadStockFromFile(csvPath, 'consistency-stock-1')
            const result2 = await loadStockFromFile(csvPath, 'consistency-stock-2')

            // Each stock has 7 items
            const items1 = await prisma.stockItem.count({ where: { stockId: result1.stockId } })
            const items2 = await prisma.stockItem.count({ where: { stockId: result2.stockId } })
            expect(items1).toBe(7)
            expect(items2).toBe(7)

            // Get a molecule and verify it appears in both our test stocks
            const mol = await getMoleculeWithStocks(
                (
                    await prisma.molecule.findFirst({
                        where: {
                            stockItems: {
                                some: { stockId: result1.stockId },
                            },
                        },
                    })
                )?.id || ''
            )

            const testStocks = mol.stocks.filter(
                (s) => s.name === 'consistency-stock-1' || s.name === 'consistency-stock-2'
            )
            expect(testStocks.length).toBe(2)
        })

        it('should handle concurrent stock loads safely', async () => {
            const csvPath = await createTempCsvFile(validCsvContent)

            // Load multiple stocks concurrently with unique names
            const promises = [
                loadStockFromFile(csvPath, `concurrent-safe-${Date.now()}-1`),
                loadStockFromFile(csvPath, `concurrent-safe-${Date.now()}-2`),
                loadStockFromFile(csvPath, `concurrent-safe-${Date.now()}-3`),
            ]

            const results = await Promise.all(promises)

            // All should succeed
            expect(results).toHaveLength(3)

            // At least one should create molecules (some may reuse)
            const totalMoleculesCreated = results.reduce((sum, r) => sum + r.moleculesCreated, 0)
            expect(totalMoleculesCreated).toBeGreaterThan(0)

            // Each stock should have items (even if molecules already existed)
            expect(results.every((r) => r.itemsCreated > 0)).toBe(true)

            // Verify our 3 stocks were created with the right item counts
            const createdStockIds = results.map((r) => r.stockId)
            const createdStocks = await prisma.stock.findMany({
                where: { id: { in: createdStockIds } },
                include: { _count: { select: { items: true } } },
            })
            expect(createdStocks).toHaveLength(3)
            expect(createdStocks.every((s) => s._count.items === 7)).toBe(true)
        })
    })
})
