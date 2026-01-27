'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, ChevronsUpDown } from 'lucide-react'

import type { PredictionRunSummary } from '@/types' // <-- now correctly imported
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface ModelSelectorProps {
    runs: PredictionRunSummary[]
    selectedRunId?: string

    paramName: 'model1' | 'model2'
    rankParamName: 'rank1' | 'rank2'
}

export function ModelSelector({ runs, selectedRunId, paramName, rankParamName }: ModelSelectorProps) {
    const [open, setOpen] = React.useState(false)
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const selectedRun = runs.find((run) => run.id === selectedRunId)

    const handleSelect = (runId: string) => {
        const params = new URLSearchParams(searchParams.toString())
        const selectedRun = runs.find((r) => r.id === runId)
        const firstRank = selectedRun?.availableRanks[0] ?? 1

        params.set(paramName, runId)
        params.set(rankParamName, String(firstRank))

        const newHref = `${pathname}?${params.toString()}`

        router.replace(newHref, { scroll: false })
        setOpen(false)
    }

    const formatDate = (date: Date) =>
        new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))

    const getSearchValue = (run: PredictionRunSummary) => {
        const parts = [run.modelName, run.algorithmName, run.modelVersion ?? ''].filter(Boolean)

        return parts.join(' ').toLowerCase()
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-[400px] justify-between">
                    {selectedRun ? (
                        <span className="flex items-center gap-2 truncate">
                            <span className="font-medium">{selectedRun.modelName}</span>
                            {selectedRun.modelVersion && (
                                <span className="text-muted-foreground text-xs">{selectedRun.modelVersion}</span>
                            )}
                        </span>
                    ) : (
                        <span className="text-muted-foreground">Select model prediction...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0">
                <Command>
                    <CommandInput placeholder="Search models..." className="h-9" />
                    <CommandList>
                        <CommandEmpty>No models found.</CommandEmpty>
                        <CommandGroup>
                            {runs.map((run) => (
                                <CommandItem
                                    key={run.id}
                                    value={getSearchValue(run)}
                                    onSelect={() => handleSelect(run.id)}
                                >
                                    <div className="flex w-full items-center justify-between">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{run.modelName}</span>
                                                {run.modelVersion && (
                                                    <span className="text-muted-foreground text-xs">
                                                        {run.modelVersion}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-muted-foreground text-xs">
                                                {run.algorithmName} • {formatDate(run.executedAt)} • {run.routeCount}{' '}
                                                routes
                                            </div>
                                        </div>
                                        <Check
                                            className={cn(
                                                'ml-2 h-4 w-4',
                                                selectedRunId === run.id ? 'opacity-100' : 'opacity-0'
                                            )}
                                        />
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
