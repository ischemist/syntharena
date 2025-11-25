import path from 'path'
import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

// Load test environment variables
config({ path: '.env.test' })

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        fileParallelism: false,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/lib/route-visualization/**/*.ts', 'src/lib/services/**/*.ts'],
            exclude: ['src/lib/route-visualization/index.ts'],
        },
        globalSetup: ['./tests/global-setup.ts'],
        setupFiles: ['./tests/setup.ts'],
        env: {
            NODE_ENV: 'test',
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})
