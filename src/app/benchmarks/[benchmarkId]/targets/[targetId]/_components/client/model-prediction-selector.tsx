'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, ChevronsUpDown, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface PredictionRun {
    id: string
    modelName: string
    modelVersion?: string
    algorithmName: string
    executedAt: Date
    routeCount: number
    maxRank: number
}

interface ModelPredictionSelectorProps {
    runs: PredictionRun[]
    paramName: 'model1' | 'model2'
    label: string
    selectedRunId?: string
}

export function ModelPredictionSelector({ runs, paramName, label, selectedRunId }: ModelPredictionSelectorProps) {
    const [open, setOpen] = React.useState(false)
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const selectedRun = runs.find((run) => run.id === selectedRunId)
    const rankParamName = paramName === 'model1' ? 'rank1' : 'rank2'

    const handleSelect = (runId: string) => {
        const params = new URLSearchParams(searchParams.toString())

        if (runId === selectedRunId) {
            // Deselect - remove the param
            params.delete(paramName)
            // Also remove corresponding rank param
            params.delete(rankParamName)
        } else {
            // Select new run
            params.set(paramName, runId)
            // Reset rank to 1
            params.set(rankParamName, '1')
        }

        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        setOpen(false)
    }

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        const params = new URLSearchParams(searchParams.toString())
        params.delete(paramName)
        params.delete(rankParamName)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }).format(new Date(date))
    }

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}:</span>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-[400px] justify-between"
                    >
                        {selectedRun ? (
                            <span className="flex items-center gap-2">
                                <span className="font-medium">{selectedRun.modelName}</span>
                                {selectedRun.modelVersion && (
                                    <span className="text-muted-foreground text-xs">{selectedRun.modelVersion}</span>
                                )}
                                <span className="text-muted-foreground text-xs">
                                    • {formatDate(selectedRun.executedAt)}
                                </span>
                            </span>
                        ) : (
                            <span className="text-muted-foreground">Select model prediction...</span>
                        )}
                        <div className="flex items-center gap-1">
                            {selectedRun && (
                                <X
                                    className="h-4 w-4 opacity-50 hover:opacity-100"
                                    onClick={handleClear}
                                    aria-label="Clear selection"
                                />
                            )}
                            <ChevronsUpDown className="h-4 w-4 opacity-50" />
                        </div>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                    <Command>
                        <CommandInput placeholder="Search models..." className="h-9" />
                        <CommandList>
                            <CommandEmpty>No models found.</CommandEmpty>
                            <CommandGroup>
                                {runs.map((run) => {
                                    const searchValue =
                                        `${run.modelName} ${run.algorithmName} ${run.modelVersion ?? ''}`.toLowerCase()
                                    return (
                                        <CommandItem
                                            key={run.id}
                                            value={searchValue}
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
                                                        {run.algorithmName} • {formatDate(run.executedAt)} •{' '}
                                                        {run.routeCount} {run.routeCount === 1 ? 'route' : 'routes'}
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
                                    )
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    )
}
