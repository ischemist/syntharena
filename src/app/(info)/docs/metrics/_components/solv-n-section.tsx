import { InfoIcon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function SolvNSection() {
    return (
        <Card variant="bordered">
            <CardHeader>
                <CardTitle>Tier-0 validity and Solv-0[stock]</CardTitle>
                <CardDescription>
                    SynthArena reports two separate target-level success predicates. Neither is a reaction-feasibility
                    claim.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="space-y-2">
                    <h3 className="font-semibold">Tier-0 validity rate</h3>
                    <p className="text-muted-foreground text-sm">
                        The fraction of benchmark targets for which the planner produced at least one syntactically
                        valid candidate: its molecular graphs and reaction records are well formed. Tier-0 does not
                        establish reaction topology, chemical feasibility, or stock termination.
                    </p>
                    <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                        targets with ≥1 Tier-0-pass candidate / all benchmark targets
                    </div>
                </div>

                <div className="space-y-2">
                    <h3 className="font-semibold">Solv-0[stock] rate</h3>
                    <p className="text-muted-foreground text-sm">
                        The fraction of benchmark targets for which at least one candidate passes Tier-0 and terminates
                        in the named stock. The stock label is part of the metric identity: Solv-0[buyables-stock] and
                        Solv-0[n5-stock] are different predicates and must not be compared as if they used the same
                        task.
                    </p>
                    <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                        targets with ≥1 candidate passing Tier-0 and stock constraints / all benchmark targets
                    </div>
                </div>

                <Alert>
                    <InfoIcon className="h-4 w-4" />
                    <AlertDescription>
                        A higher tier adds a distinct validity predicate. SynthArena currently exposes Tier-0 and Solv-0
                        only; missing Tier-1+ evidence is shown as unavailable, never converted into failure.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    )
}
