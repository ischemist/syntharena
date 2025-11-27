import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Shared container component for consistent bordered sections.
 * Used for statistics, visualizations, and other content sections.
 * Provides subtle border styling without heavy shadows.
 */
export function SectionContainer({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn(
                'rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/50',
                className
            )}
            {...props}
        />
    )
}
