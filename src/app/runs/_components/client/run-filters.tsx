'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'

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
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <MultiSelectCombobox
                options={modelFamilies}
                selected={currentFamilies}
                onChange={(value) => handleFilterChange('families', value)}
                className="w-full md:max-w-[300px] md:min-w-[200px] md:flex-1"
                placeholder="All Model Families"
            />

            <Select
                value={currentSubmission || undefined}
                onValueChange={(value) => handleFilterChange('submission', value)}
            >
                <SelectTrigger id="submission-filter" className="w-full md:max-w-[220px] md:min-w-[180px] md:flex-1">
                    <SelectValue placeholder="All Submissions" />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        <SelectItem value="all">All Submissions</SelectItem>
                        <SelectItem value="MAINTAINER_VERIFIED">Maintainer Verified</SelectItem>
                        <SelectItem value="COMMUNITY_SUBMITTED">Community Submitted</SelectItem>
                    </SelectGroup>
                </SelectContent>
            </Select>

            {(currentFamilies.length > 0 || currentSubmission) && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground w-full gap-2 md:w-auto"
                    onClick={() => router.replace(pathname, { scroll: false })}
                >
                    <X className="h-4 w-4" />
                    Clear
                </Button>
            )}
        </div>
    )
}
