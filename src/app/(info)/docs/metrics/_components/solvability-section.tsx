import { AlertTriangleIcon, InfoIcon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function SolvabilitySection() {
    return (
        <Card variant="bordered">
            <CardHeader>
                <CardTitle>Stock-Termination Rate (STR)</CardTitle>
                <CardDescription>
                    Stock-Termination Rate is the fraction of target molecules for which the model finds{' '}
                    <strong>at least one route</strong> where{' '}
                    <strong>all terminal nodes (leaves) are in the stock</strong>.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <h3 className="font-semibold">Formula</h3>
                    <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                        STR = (Number of targets with at least 1 stock-terminated route) / (Total number of targets)
                    </div>
                </div>

                <div className="space-y-2">
                    <h3 className="font-semibold">Example</h3>
                    <div className="text-muted-foreground text-sm">
                        <p>
                            A model is evaluated on 1,000 target molecules using the Buyables stock. The model produces:
                        </p>
                        <ul className="mt-2 ml-6 list-disc space-y-1">
                            <li>850 targets with at least one route ending in Buyables chemicals</li>
                            <li>150 targets with no routes terminating in stock</li>
                        </ul>
                        <p className="mt-2">
                            <strong>STR = 850 / 1,000 = 0.85 (85%)</strong>
                        </p>
                    </div>
                </div>

                <Alert variant="warning">
                    <AlertTriangleIcon className="h-4 w-4" />
                    <AlertDescription>
                        <strong>Important limitation:</strong> STR is a purely topological check. It verifies that
                        leaves are in stock but provides no guarantee of chemical validity for intermediate steps. High
                        STR scores can mask chemically implausible transformations.
                    </AlertDescription>
                </Alert>

                <Alert>
                    <InfoIcon className="h-4 w-4" />
                    <AlertDescription>
                        <strong>Practical use:</strong> STR is a necessary but insufficient filter. A route cannot be
                        executed without available starting materials, but stock termination alone does not ensure the
                        route is chemically sound.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    )
}
