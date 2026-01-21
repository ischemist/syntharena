import { cn } from '@/lib/utils'

export const ControlGrid = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            'grid items-end gap-x-4 gap-y-2',
            // a responsive grid: 1 col on mobile, auto-fit on larger screens
            'grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]',
            className
        )}
        {...props}
    />
)

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
        <div className="flex items-center gap-2">{children}</div>
    </div>
)
