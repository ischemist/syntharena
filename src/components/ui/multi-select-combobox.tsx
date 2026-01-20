'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type MultiSelectOption = {
    value: string
    label: string
}

interface MultiSelectComboboxProps {
    options: MultiSelectOption[]
    selected: string[]
    onChange: (selected: string[]) => void
    className?: string
    placeholder?: string
}

export function MultiSelectCombobox({
    options,
    selected,
    onChange,
    className,
    placeholder = 'Select options...',
}: MultiSelectComboboxProps) {
    const [open, setOpen] = React.useState(false)

    const handleSelect = (value: string) => {
        const isSelected = selected.includes(value)
        const newSelected = isSelected ? selected.filter((item) => item !== value) : [...selected, value]
        onChange(newSelected)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn('w-full justify-between', className)}
                    onClick={() => setOpen(!open)}
                >
                    <div className="flex flex-wrap items-center gap-1">
                        {selected.length === 0 && <span className="text-muted-foreground">{placeholder}</span>}
                        {selected.slice(0, 3).map((value) => (
                            <Badge variant="secondary" key={value} className="mr-1">
                                {options.find((option) => option.value === value)?.label}
                            </Badge>
                        ))}
                        {selected.length > 3 && <Badge variant="secondary">+{selected.length - 3} more</Badge>}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search..." />
                    <CommandList>
                        <CommandEmpty>No options found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => handleSelect(option.value)}
                                >
                                    <Check
                                        className={cn(
                                            'mr-2 h-4 w-4',
                                            selected.includes(option.value) ? 'opacity-100' : 'opacity-0'
                                        )}
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
