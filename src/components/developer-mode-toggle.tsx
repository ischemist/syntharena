'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Microscope, Trophy } from 'lucide-react'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function DeveloperModeToggle() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const isDevMode = searchParams.get('dev') === 'true'

    const handleToggle = (checked: boolean) => {
        const params = new URLSearchParams(searchParams.toString())
        if (checked) {
            params.set('dev', 'true')
        } else {
            params.delete('dev')
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex items-center space-x-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Label htmlFor="dev-mode-toggle" className="flex cursor-pointer items-center gap-1.5">
                            <Trophy className="size-4" />
                            <span>Curated</span>
                        </Label>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Shows only the best-performing version of each model family.</p>
                    </TooltipContent>
                </Tooltip>

                <Switch
                    id="dev-mode-toggle"
                    checked={isDevMode}
                    onCheckedChange={handleToggle}
                    aria-label="Toggle developer mode"
                />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Label htmlFor="dev-mode-toggle" className="flex cursor-pointer items-center gap-1.5">
                            <Microscope className="size-4" />
                            <span>Developer</span>
                        </Label>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Shows all versions and instances for detailed comparison.</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    )
}
