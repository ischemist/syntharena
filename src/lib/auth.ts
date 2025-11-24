// ============================================================================
// Authentication & User Management
// ============================================================================

/**
 * The default user ID used for single-user mode.
 *
 * This constant provides a single source of truth for the default user
 * throughout the application. When multi-user authentication is added,
 * this will be used as a fallback for unauthenticated requests.
 *
 * The corresponding user record is created via Prisma seed.
 */
export const DEFAULT_USER_ID = 'arena-default-user'

/**
 * The default username for the single-user mode.
 */
export const DEFAULT_USERNAME = 'procrustes'

/**
 * Gets the current user's ID.
 *
 * In single-user mode, this always returns the default user ID.
 * When authentication is implemented, this will return the authenticated
 * user's ID from the session, falling back to the default user if not authenticated.
 *
 * @returns The current user's ID
 *
 * @example
 * ```ts
 * const userId = await getCurrentUserId()
 * const projects = await getProjects(userId)
 * ```
 */
export async function getCurrentUserId(): Promise<string> {
    // TODO: Implement session-based authentication
    // const session = await auth()
    // return session?.user?.id ?? DEFAULT_USER_ID

    return DEFAULT_USER_ID
}

/**
 * Type guard to check if a user ID is the default user.
 * Useful for conditional logic that only applies to the default user.
 *
 * @param userId The user ID to check
 * @returns True if the user is the default user
 */
export function isDefaultUser(userId: string): boolean {
    return userId === DEFAULT_USER_ID
}
