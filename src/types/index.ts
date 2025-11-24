// ============================================================================
// Server Action Response Type
// ============================================================================

/**
 * A standard wrapper for server action responses, providing a consistent
 * structure for handling success and failure states on the client.
 */
export type ActionState<T> =
    | {
          isSuccess: true
          message: string
          data: T
      }
    | {
          isSuccess: false
          message: string
          data?: undefined // Explicitly forbid data on failure for type safety
      }
