import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'

import { ActionState } from '@/types'

// ============================================================================
// Error Codes for Structured Error Handling
// ============================================================================

/**
 * Standard error codes for server actions.
 * Use these for programmatic error handling on the client.
 */
export enum ActionErrorCode {
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    NOT_FOUND = 'NOT_FOUND',
    FORBIDDEN = 'FORBIDDEN',
    CONFLICT = 'CONFLICT',
    INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Extended ActionState with optional error code.
 */
export type ActionStateWithCode<T> = ActionState<T> & {
    code?: ActionErrorCode
}

// ============================================================================
// Revalidation Configuration
// ============================================================================

/**
 * Configuration for automatic cache revalidation after successful mutations.
 */
export interface RevalidationConfig {
    /** Paths to revalidate (e.g., '/projects', '/projects/[id]') */
    paths?: string[]
    /** Tags to revalidate (e.g., 'projects', 'project-detail') */
    tags?: string[]
}

// ============================================================================
// createSafeAction - Main Server Action Wrapper
// ============================================================================

/**
 * Creates a type-safe server action with validation and error handling.
 *
 * Features:
 * - Zod schema validation with structured error messages
 * - Automatic error handling and logging
 * - Optional cache revalidation on success
 * - Error codes for programmatic handling
 *
 * Usage:
 * ```ts
 * export const updateProjectAction = createSafeAction(
 *   UpdateProjectSchema,
 *   async (input) => {
 *     // ... service call
 *     return { isSuccess: true, message: 'Updated!', data: project }
 *   },
 *   { paths: ['/projects'] } // optional revalidation
 * )
 * ```
 *
 * @param schema The Zod schema to validate input against
 * @param handler The action logic, receives validated input
 * @param revalidation Optional paths/tags to revalidate on success
 * @returns A validated, error-handled server action
 */
export function createSafeAction<TInput extends z.ZodTypeAny, TOutput>(
    schema: TInput,
    handler: (input: z.infer<TInput>) => Promise<ActionState<TOutput>>,
    revalidation?: RevalidationConfig
) {
    return async (input?: z.infer<TInput>): Promise<ActionStateWithCode<TOutput>> => {
        // ====================================================================
        // Step 1: Input Validation
        // ====================================================================
        const finalInput = input ?? {}
        const validationResult = schema.safeParse(finalInput)

        if (!validationResult.success) {
            // Format validation errors into a readable string
            const errors = validationResult.error.issues.map((err) => {
                const pathStr = err.path.map(String).join('.')
                return pathStr ? `${pathStr}: ${err.message}` : err.message
            })
            return {
                isSuccess: false,
                message: errors.length > 0 ? errors.join('; ') : 'Invalid input',
                code: ActionErrorCode.VALIDATION_ERROR,
            }
        }

        // ====================================================================
        // Step 2: Execute Handler
        // ====================================================================
        try {
            const result = await handler(validationResult.data)

            // If successful and revalidation config provided, revalidate caches
            if (result.isSuccess && revalidation) {
                if (revalidation.paths) {
                    revalidation.paths.forEach((path) => revalidatePath(path, 'page'))
                }
                if (revalidation.tags) {
                    revalidation.tags.forEach((tag) => revalidateTag(tag, 'default'))
                }
            }

            return result
        } catch (error) {
            // ================================================================
            // Step 3: Error Handling
            // ================================================================
            console.error('Server action failed:', error)

            // Attempt to parse known error types
            if (error instanceof Error) {
                const message = error.message.toLowerCase()

                // Determine error code based on message content
                let code = ActionErrorCode.INTERNAL_ERROR
                if (message.includes('not found')) {
                    code = ActionErrorCode.NOT_FOUND
                } else if (
                    message.includes('permission') ||
                    message.includes('unauthorized') ||
                    message.includes('forbidden')
                ) {
                    code = ActionErrorCode.FORBIDDEN
                } else if (
                    message.includes('already exists') ||
                    message.includes('conflict') ||
                    message.includes('unique')
                ) {
                    code = ActionErrorCode.CONFLICT
                }

                return {
                    isSuccess: false,
                    message: error.message,
                    code,
                }
            }

            // Fallback for unknown errors
            return {
                isSuccess: false,
                message: 'An unexpected error occurred. Please try again.',
                code: ActionErrorCode.INTERNAL_ERROR,
            }
        }
    }
}
