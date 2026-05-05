import type { NextConfig } from 'next'
import packageJson from './package.json'

const nextConfig: NextConfig = {
    env: {
        NEXT_PUBLIC_APP_VERSION: packageJson.version,
    },
    output: 'standalone',
    outputFileTracingIncludes: {
        '/**/*': [
            './node_modules/@prisma/adapter-better-sqlite3/**/*',
            './node_modules/@prisma/client/**/*',
            './node_modules/.prisma/client/**/*',
            './node_modules/better-sqlite3/build/Release/**/*',
            './node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build/Release/**/*',
        ],
    },
    reactCompiler: true,
}

export default nextConfig
