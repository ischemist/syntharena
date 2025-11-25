import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

/**
 * Global test setup that runs once before all test files
 * Creates and initializes the test database
 */

const testDatabasePath = path.resolve('./prisma/test.db')

export async function setup() {
    // Remove existing test database to start fresh
    if (fs.existsSync(testDatabasePath)) {
        fs.unlinkSync(testDatabasePath)
        console.log('Removed existing test database')
    }

    // Create test database with schema
    try {
        console.log('Setting up test database...')
        execSync('pnpm exec prisma db push', {
            env: {
                ...process.env,
                DATABASE_URL: `file:${testDatabasePath}`,
            },
            stdio: 'pipe',
        })
        console.log('Test database ready')
    } catch (error) {
        console.error('Failed to setup test database:', error)
        throw error
    }
}

export async function teardown() {
    // Clean up test database after all tests
    try {
        if (fs.existsSync(testDatabasePath)) {
            fs.unlinkSync(testDatabasePath)
            console.log('Test database cleaned up')
        }
    } catch (error) {
        console.error('Failed to cleanup test database:', error)
    }
}
