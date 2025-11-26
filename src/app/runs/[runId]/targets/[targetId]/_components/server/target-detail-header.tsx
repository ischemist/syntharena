import Link from 'next/link'

import type { TargetPredictionDetail } from '@/types'
import { Badge } from '@/components/ui/badge'
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type TargetDetailHeaderProps = {
    target: TargetPredictionDetail
    runId: string
}

export function TargetDetailHeader({ target, runId }: TargetDetailHeaderProps) {
    return (
        <div className="space-y-4">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                            <Link href="/runs">Runs</Link>
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                            <Link href={`/runs/${runId}`}>Run Details</Link>
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>{target.targetId}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <Card>
                <CardHeader>
                    <CardTitle className="font-mono text-2xl">{target.targetId}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <div className="text-muted-foreground text-sm">SMILES</div>
                        <div className="font-mono text-sm break-all">{target.molecule.smiles}</div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        {target.routeLength && (
                            <div>
                                <div className="text-muted-foreground text-sm">Route Length</div>
                                <div className="text-lg font-medium">{target.routeLength}</div>
                            </div>
                        )}
                        {target.isConvergent !== null && (
                            <div>
                                <div className="text-muted-foreground text-sm">Convergent</div>
                                <Badge variant={target.isConvergent ? 'secondary' : 'outline'}>
                                    {target.isConvergent ? 'Yes' : 'No'}
                                </Badge>
                            </div>
                        )}
                        {target.groundTruthRoute && (
                            <div>
                                <div className="text-muted-foreground text-sm">Ground Truth</div>
                                <Badge variant="secondary">Available</Badge>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
