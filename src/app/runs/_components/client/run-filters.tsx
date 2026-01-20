'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type FilterOption = { id: string; name: string }

type RunFiltersProps = {
    benchmarks: FilterOption[]
    modelFamilies: FilterOption[]
}

export function RunFilters({ benchmarks, modelFamilies }: RunFiltersProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const currentBenchmark = searchParams.get('benchmark')
    const currentFamily = searchParams.get('family')

    const handleFilterChange = (key: 'benchmark' | 'family', value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value === 'all') {
            params.delete(key)
        } else {
            params.set(key, value)
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    return (
        <div className="bg-card border-border/60 flex items-center gap-6 rounded-lg border p-4">
            <div className="flex items-center gap-3">
                <Label htmlFor="benchmark-filter">Benchmark</Label>
                <Select
                    value={currentBenchmark ?? 'all'}
                    onValueChange={(value) => handleFilterChange('benchmark', value)}
                >
                    <SelectTrigger id="benchmark-filter" className="w-[250px]">
                        <SelectValue placeholder="All Benchmarks" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectItem value="all">All Benchmarks</SelectItem>
                            {benchmarks.map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                    {b.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center gap-3">
                <Label htmlFor="family-filter">Model Family</Label>
                <Select value={currentFamily ?? 'all'} onValueChange={(value) => handleFilterChange('family', value)}>
                    <SelectTrigger id="family-filter" className="w-[250px]">
                        <SelectValue placeholder="All Model Families" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectItem value="all">All Model Families</SelectItem>
                            {modelFamilies.map((f) => (
                                <SelectItem key={f.id} value={f.id}>
                                    {f.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>

            {(currentBenchmark || currentFamily) && (
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
