import type { BenchmarkSet } from '@prisma/client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

type TargetFilterBarProps = {
    benchmarkSet: BenchmarkSet
}

export function TargetFilterBar({ benchmarkSet }: TargetFilterBarProps) {
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium">Filters:</span>
                        {/* Filter buttons will be added here as client components */}
                        <span className="text-muted-foreground text-sm">
                            Coming soon: Filter by solvability, route length, GT status
                        </span>
                    </div>
                    {benchmarkSet.hasGroundTruth && <Badge variant="secondary">Ground Truth Available</Badge>}
                </div>
            </CardContent>
        </Card>
    )
}
