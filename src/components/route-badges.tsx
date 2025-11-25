'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Translucent badge variants for route metadata display.
 * Designed to be subtle and compact.
 */
const routeBadgeVariants = cva(
    'inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
    {
        variants: {
            /**
             * Style variants:
             * - ghost: translucent bg only, no border (most subtle)
             * - soft: translucent bg with matching border (balanced)
             * - outline: border only, no fill (minimal)
             */
            variant: {
                ghost: 'border-transparent bg-blue-500/15 text-blue-600 dark:text-blue-400',
                soft: 'border bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
                outline: 'border bg-transparent text-blue-600 dark:text-blue-400 border-blue-500/40',
            },
        },
        defaultVariants: {
            variant: 'ghost',
        },
    }
)

type RouteBadgeVariantProps = VariantProps<typeof routeBadgeVariants>

interface RouteBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'>, RouteBadgeVariantProps {}

function RouteBadge({ className, variant, ...props }: RouteBadgeProps) {
    return <span className={cn(routeBadgeVariants({ variant }), className)} {...props} />
}

/**
 * Compact badge with tooltip wrapper
 */
interface CompactBadgeProps extends RouteBadgeProps {
    tooltip: string
}

function CompactBadge({ tooltip, children, ...props }: CompactBadgeProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <RouteBadge {...props}>{children}</RouteBadge>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
    )
}

/**
 * Displays route length (ground truth steps) - compact version
 */
interface RouteLengthBadgeProps extends Omit<RouteBadgeProps, 'children'> {
    length: number
}

function RouteLengthBadge({ length, ...props }: RouteLengthBadgeProps) {
    return (
        <CompactBadge
            tooltip={`Ground truth route: ${length} steps`}
            variant="outline"
            className="border-slate-500/30 text-slate-600 dark:text-slate-400"
            {...props}
        >
            {length} steps
        </CompactBadge>
    )
}

/**
 * Displays convergent/linear route topology - compact version
 */
interface RouteTypeBadgeProps extends Omit<RouteBadgeProps, 'children'> {
    isConvergent: boolean
}

function RouteTypeBadge({ isConvergent, ...props }: RouteTypeBadgeProps) {
    return (
        <CompactBadge
            tooltip={
                isConvergent
                    ? 'Convergent: route has reactions combining multiple intermediates'
                    : 'Linear: sequential route with no branching'
            }
            variant="ghost"
            className={
                isConvergent
                    ? 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300'
                    : 'bg-pink-500/12 text-pink-700 dark:text-pink-300'
            }
            {...props}
        >
            {isConvergent ? 'CNV' : 'LIN'}
        </CompactBadge>
    )
}

export { RouteBadge, routeBadgeVariants, CompactBadge, RouteLengthBadge, RouteTypeBadge }
