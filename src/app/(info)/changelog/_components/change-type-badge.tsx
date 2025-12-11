import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

export const ChangeType = {
    FEAT: 'feat',
    UI_UX: 'ui/ux',
    BUGFIX: 'bugfix',
    DATA: 'data',
    DOCS: 'docs',
    PERF: 'perf',
} as const

export type ChangeType = (typeof ChangeType)[keyof typeof ChangeType]

const changeTypeBadgeVariants = cva(
    'inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap border w-20',
    {
        variants: {
            type: {
                [ChangeType.FEAT]: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
                [ChangeType.UI_UX]: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
                [ChangeType.BUGFIX]: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
                [ChangeType.DATA]: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
                [ChangeType.PERF]: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
                [ChangeType.DOCS]: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
            },
        },
        defaultVariants: {
            type: ChangeType.FEAT,
        },
    }
)

const changeTypeLabels: Record<ChangeType, string> = {
    [ChangeType.FEAT]: 'Feature',
    [ChangeType.UI_UX]: 'UI/UX',
    [ChangeType.BUGFIX]: 'Bug Fix',
    [ChangeType.DATA]: 'Data',
    [ChangeType.DOCS]: 'Docs',
    [ChangeType.PERF]: 'Perf',
}

interface ChangeTypeBadgeProps extends Omit<VariantProps<typeof changeTypeBadgeVariants>, 'type'> {
    type: ChangeType
    className?: string
}

export function ChangeTypeBadge({ type, className }: ChangeTypeBadgeProps) {
    return <span className={cn(changeTypeBadgeVariants({ type }), className)}>{changeTypeLabels[type]}</span>
}
