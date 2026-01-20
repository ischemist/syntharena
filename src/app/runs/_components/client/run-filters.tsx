'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'

import { SUBMISSION_TYPES, type SubmissionType } from '@/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
        <div className="bg-card border-border/60 flex items-center gap-6 rounded-lg border p-4">
            <div className="flex items-center gap-3">
                <Label>Model Family</Label>
                <MultiSelectCombobox
                    options={modelFamilies}
                    selected={currentFamilies}
                    onChange={(value) => handleFilterChange('families', value)}
                    className="w-[300px]"
                    placeholder="All Model Families"
                />
            </div>

            <div className="flex items-center gap-3">
                <Label htmlFor="submission-filter">Submission</Label>
                <Select
                    value={currentSubmission ?? 'all'}
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
                    className="text-muted-foreground gap-2"
                    onClick={() => router.replace(pathname, { scroll: false })}
                >
                    <X className="h-4 w-4" />
                    Clear Filters
                </Button>
            )}
        </div>
    )
}
