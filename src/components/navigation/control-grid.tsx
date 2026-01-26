import { cn } from '@/lib/utils'

/** a layout primitive that enforces rigid, responsive alignment for control panels. */
export const ControlGrid = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn('grid items-end gap-x-6 gap-y-4 md:grid-cols-2', className)} {...props} />
)

/** a labeled slot within the control grid. */
export const ControlGridSlot = ({
    label,
    className,
    children,
}: {
    label: string
    className?: string
    children: React.ReactNode
}) => (
    <div className={cn('flex flex-col gap-1.5', className)}>
        <label className="text-muted-foreground text-sm font-medium">{label}</label>
        {children}
    </div>
)
