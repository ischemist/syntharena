import { z } from 'zod'

/**
 * Schema for searching molecules across stocks.
 * Validates search query and optional filters.
 * Query is optional - if empty, returns all molecules (filtered by stock if provided).
 */
export const SearchMoleculesSchema = z.object({
    query: z.string().max(1000, 'Search query is too long').optional().default(''),
    stockId: z.string().cuid2('Valid stock ID required').optional(),
    limit: z.number().int().min(1).max(1000).default(50),
    offset: z.number().int().min(0).default(0),
})

export type SearchMoleculesInput = z.infer<typeof SearchMoleculesSchema>

/**
 * Schema for validating stock ID.
 * Used for single stock queries.
 */
export const StockIdSchema = z.object({
    id: z.string().cuid2('Valid stock ID required'),
})

export type StockIdInput = z.infer<typeof StockIdSchema>

/**
 * Schema for creating a new stock.
 * Used by the stock loader.
 */
export const CreateStockSchema = z.object({
    name: z
        .string()
        .min(1, 'Stock name is required')
        .max(255, 'Stock name is too long')
        .regex(/^[a-z0-9-]+$/, 'Stock name must be lowercase alphanumeric with hyphens only (URL-safe)'),
    description: z.string().max(1000, 'Description is too long').optional(),
})

export type CreateStockInput = z.infer<typeof CreateStockSchema>

/**
 * Schema for deleting a stock.
 */
export const DeleteStockSchema = z.object({
    stockId: z.string().cuid2('Valid stock ID required'),
})

export type DeleteStockInput = z.infer<typeof DeleteStockSchema>

/**
 * Schema for filtering stock molecules by commercial metadata.
 * Used for client-side filter controls validation.
 */
export const StockMoleculeFiltersSchema = z.object({
    vendors: z.array(z.enum(['MC', 'LN', 'EM', 'SA', 'CB'])).optional(),
    minPpg: z.number().min(0, 'Minimum price must be non-negative').optional(),
    maxPpg: z.number().min(0, 'Maximum price must be non-negative').optional(),
    buyableOnly: z.boolean().optional(),
})

export type StockMoleculeFiltersInput = z.infer<typeof StockMoleculeFiltersSchema>
