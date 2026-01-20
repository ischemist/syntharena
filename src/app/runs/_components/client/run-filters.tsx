'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'

import { SUBMISSION_TYPES } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { MultiSelectCombobox, type MultiSelectOption } from '@/components/ui/multi-select-combobox'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type RunFiltersProps = {
    modelFamilies: MultiSelectOption[]
}

export function RunFilters({ modelFamilies }: RunFiltersProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const currentFamilies = searchParams.get('families')?.split(',') ?? []
    const currentSubmission = searchParams.get('submission')

    const handleFilterChange = (key: 'families' | 'submission', value: string | string[]) => {
        const params = new URLSearchParams(searchParams.toString())

        if (Array.isArray(value)) {
            if (value.length > 0) {
                params.set(key, value.join(','))
            } else {
                params.delete(key)
            }
        } else {
            if (value === 'all') {
                params.delete(key)
            } else {
                params.set(key, value)
            }
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    return (
        <div className="flex items-center gap-4">
            {/* --- CHANGE: Removed the <Label> and adjusted gap. --- */}
            <div className="flex items-center gap-2">
                <MultiSelectCombobox
                    options={modelFamilies}
                    selected={currentFamilies}
                    onChange={(value) => handleFilterChange('families', value)}
                    className="w-[300px]"
                    placeholder="All Model Families"
                />
            </div>

            <div className="flex items-center gap-2">
                <Select
                    value={currentSubmission || undefined}
                    onValueChange={(value) => handleFilterChange('submission', value)}
                >
                    <SelectTrigger id="submission-filter" className="w-[220px]">
                        <SelectValue placeholder="All Submissions" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectItem value="all">All Submissions</SelectItem>
                            <SelectItem value={SUBMISSION_TYPES[0]}>Maintainer Verified</SelectItem>
                            <SelectItem value={SUBMISSION_TYPES[1]}>Community Submitted</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>

            {(currentFamilies.length > 0 || currentSubmission) && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground gap-2"
                    onClick={() => router.replace(pathname, { scroll: false })}
                >
                    <X className="h-4 w-4" />
                    Clear
                </Button>
            )}
        </div>
    )
}
