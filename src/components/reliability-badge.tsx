'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { AlertCircle, AlertTriangle } from 'lucide-react'

import type { ReliabilityFlag } from '@/types'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Badge variants for reliability flags on statistical metrics.
 * LOW_N = amber (warning about insufficient sample size)
 * EXTREME_P = blue (informational about boundary effects)
 */
const reliabilityBadgeVariants = cva(
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
                ghost: 'border-transparent',
                soft: 'border',
                outline: 'border bg-transparent',
            },
            /**
             * Reliability code determines color scheme
             */
            code: {
                LOW_N: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
                EXTREME_P: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
                OK: '', // Should not be rendered
            },
        },
        defaultVariants: {
            variant: 'ghost',
            code: 'LOW_N',
        },
    }
)

type ReliabilityBadgeVariantProps = VariantProps<typeof reliabilityBadgeVariants>

interface ReliabilityBadgeBaseProps
    extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'>, Omit<ReliabilityBadgeVariantProps, 'code'> {
    reliability: ReliabilityFlag
}

/**
 * Regular badge showing the reliability code text with tooltip
 */
interface ReliabilityBadgeProps extends ReliabilityBadgeBaseProps {
    iconOnly?: false
}

/**
 * Icon-only badge for compact inline display
 */
interface ReliabilityBadgeIconOnlyProps extends ReliabilityBadgeBaseProps {
    iconOnly: true
}

type Props = ReliabilityBadgeProps | ReliabilityBadgeIconOnlyProps

function ReliabilityBadge({ className, variant, reliability, iconOnly, ...props }: Props) {
    // Don't render anything for OK status
    if (reliability.code === 'OK') {
        return null
    }

    const Icon = reliability.code === 'LOW_N' ? AlertTriangle : AlertCircle
    const content = iconOnly ? (
        <Icon className="h-3 w-3" />
    ) : (
        <span className="flex items-center gap-1">
            <Icon className="h-3 w-3" />
            {reliability.code}
        </span>
    )

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    className={cn(
                        reliabilityBadgeVariants({ variant, code: reliability.code }),
                        iconOnly && 'px-1 py-1',
                        className
                    )}
                    {...props}
                >
                    {content}
                </span>
            </TooltipTrigger>
            <TooltipContent>
                <div className="space-y-1">
                    <p className="font-medium">{reliability.code}</p>
                    <p className="text-xs">{reliability.message}</p>
                </div>
            </TooltipContent>
        </Tooltip>
    )
}

export { ReliabilityBadge, reliabilityBadgeVariants }
export type { ReliabilityBadgeProps, ReliabilityBadgeIconOnlyProps }
