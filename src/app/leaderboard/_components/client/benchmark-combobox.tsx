'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, ChevronsUpDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type BenchmarkOption = {
    id: string
    name: string
}

type BenchmarkComboboxProps = {
    benchmarks: BenchmarkOption[]
    selectedId: string | null
}

/**
 * Client component for benchmark selection.
 * Following App Router Manifesto:
 * - Client component for interactive UI (useState, useRouter)
 * - Receives data as props from server parent
 * - Updates URL state via router.push (canonical state in URL)
 * - Local state only for dropdown open/closed (ephemeral UI state)
 */
export function BenchmarkCombobox({ benchmarks, selectedId }: BenchmarkComboboxProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [open, setOpen] = useState(false)

    const selectedBenchmark = benchmarks.find((b) => b.id === selectedId)

    const handleSelect = (benchmarkId: string) => {
        // Update URL with new benchmark selection, preserving existing params
        const params = new URLSearchParams(searchParams.toString())
        params.set('benchmarkId', benchmarkId)
        router.push(`${pathname}?${params.toString()}`)
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-[300px] justify-between">
                    {selectedBenchmark ? selectedBenchmark.name : 'Select benchmark...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
                <Command>
                    <CommandInput placeholder="Search benchmarks..." className="h-9" />
                    <CommandList>
                        <CommandEmpty>No benchmark found.</CommandEmpty>
                        <CommandGroup>
                            {benchmarks.map((benchmark) => (
                                <CommandItem
                                    key={benchmark.id}
                                    value={benchmark.name}
                                    onSelect={() => handleSelect(benchmark.id)}
                                >
                                    {benchmark.name}
                                    <Check
                                        className={cn(
                                            'ml-auto h-4 w-4',
                                            selectedId === benchmark.id ? 'opacity-100' : 'opacity-0'
                                        )}
                                    />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
