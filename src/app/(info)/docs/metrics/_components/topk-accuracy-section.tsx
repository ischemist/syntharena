import { InfoIcon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function TopKAccuracySection() {
    return (
        <Card variant="bordered">
            <CardHeader>
                <CardTitle>Top-K Accuracy</CardTitle>
                <CardDescription>
                    Top-K Accuracy is the fraction of targets for which an <strong>acceptable reference route</strong>{' '}
                    (typically an experimental route, e.g. from patent literature) was ranked{' '}
                    <strong>K or lower</strong> in the model&apos;s predictions.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <h3 className="font-semibold">Formula</h3>
                    <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                        Top-K Accuracy = (Number of targets with reference route ranked K) / (Total number of targets)
                    </div>
                </div>

                <div className="space-y-2">
                    <h3 className="font-semibold">Example (Top-10 Accuracy)</h3>
                    <div className="text-muted-foreground text-sm">
                        <p>
                            A model is evaluated on 1,000 target molecules with known experimental synthesis routes. For
                            each target, the model produces up to 10 predicted routes:
                        </p>
                        <ul className="mt-2 ml-6 list-disc space-y-1">
                            <li>575 targets: Reference route found in ranks 1-10</li>
                            <li>425 targets: Reference route not found in top 10 predictions</li>
                        </ul>
                        <p className="mt-2">
                            <strong>Top-10 Accuracy = 575 / 1,000 = 0.575 (57.5%)</strong>
                        </p>
                    </div>
                </div>

                <Alert>
                    <InfoIcon className="h-4 w-4" />
                    <AlertDescription>
                        <strong>Why it matters:</strong> Top-K Accuracy provides a proxy for chemical plausibility by
                        measuring how well models reproduce expert-validated routes. It&apos;s more chemically
                        meaningful than STR but inherently conservative—it cannot reward novel valid routes.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    )
}
