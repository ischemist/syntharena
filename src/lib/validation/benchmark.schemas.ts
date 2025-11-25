import { z } from 'zod'

/**
 * Schema for creating a new benchmark set.
 */
export const CreateBenchmarkSchema = z.object({
    name: z
        .string()
        .min(1, 'Benchmark name is required.')
        .max(100, 'Benchmark name must be less than 100 characters.')
        .regex(/^[a-z0-9-]+$/, {
            message: 'Benchmark name must contain only lowercase letters, numbers, and hyphens.',
        }),
    description: z.string().max(500, 'Description must be less than 500 characters.').optional(),
    stockName: z
        .string()
        .max(100, 'Stock name must be less than 100 characters.')
        .regex(/^[a-z0-9-]+$/, { message: 'Stock name must contain only lowercase letters, numbers, and hyphens.' })
        .optional(),
})

/**
 * Schema for loading a benchmark from a file.
 */
export const LoadBenchmarkFileSchema = z.object({
    filePath: z.string().min(1, 'File path is required.'),
    benchmarkName: z
        .string()
        .min(1, 'Benchmark name is required.')
        .max(100, 'Benchmark name must be less than 100 characters.')
        .regex(/^[a-z0-9-]+$/, {
            message: 'Benchmark name must contain only lowercase letters, numbers, and hyphens.',
        }),
    description: z.string().max(500, 'Description must be less than 500 characters.').optional(),
})

/**
 * Schema for searching/filtering benchmark targets.
 */
export const SearchBenchmarkTargetsSchema = z.object({
    benchmarkId: z.string().cuid2(),
    page: z.coerce.number().int().min(1, 'Page must be at least 1.').default(1),
    limit: z.coerce.number().int().min(1).max(100, 'Limit must be between 1 and 100.').default(24),
    hasGroundTruth: z
        .enum(['true', 'false'])
        .transform((val) => val === 'true')
        .optional(),
    minRouteLength: z.coerce.number().int().min(1).optional(),
    maxRouteLength: z.coerce.number().int().min(1).optional(),
    isConvergent: z
        .enum(['true', 'false'])
        .transform((val) => val === 'true')
        .optional(),
})

/**
 * Schema for getting a specific route by ID.
 */
export const GetRouteSchema = z.object({
    routeId: z.string().cuid2(),
})

/**
 * Schema for getting a specific benchmark by ID.
 */
export const GetBenchmarkSchema = z.object({
    benchmarkId: z.string().cuid2(),
})

/**
 * Schema for getting a specific target by ID.
 */
export const GetTargetSchema = z.object({
    targetId: z.string().cuid2(),
})

/**
 * Schema for deleting a benchmark.
 */
export const DeleteBenchmarkSchema = z.object({
    benchmarkId: z.string().cuid2(),
})
