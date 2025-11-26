'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { BarChart3, Table2 } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

/**
 * Client component for toggling between table and chart views.
 * Updates URL searchParams to trigger server re-render.
 */
export function ViewToggle() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const currentView = searchParams.get('view') || 'table'

    const handleViewChange = (view: 'table' | 'chart') => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('view', view)
        router.push(`/leaderboard?${params.toString()}`)
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>View Options</CardTitle>
                <CardDescription>Choose how to display the leaderboard data</CardDescription>
            </CardHeader>
            <CardContent>
                <RadioGroup
                    value={currentView}
                    onValueChange={(value: string) => handleViewChange(value as 'table' | 'chart')}
                >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="table" id="view-table" />
                        <Label htmlFor="view-table" className="flex cursor-pointer items-center gap-2">
                            <Table2 className="h-4 w-4" />
                            Table View
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="chart" id="view-chart" />
                        <Label htmlFor="view-chart" className="flex cursor-pointer items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Chart View
                        </Label>
                    </div>
                </RadioGroup>
            </CardContent>
        </Card>
    )
}
