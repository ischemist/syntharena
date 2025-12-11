import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function VerificationTiersSection() {
    return (
        <section className="space-y-6">
            <h2 className="text-2xl font-semibold">Verification Tiers</h2>

            <div className="grid gap-4 md:grid-cols-2">
                <Card variant="bordered">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <CardTitle>Verified by Maintainer</CardTitle>
                            <Badge variant="default">Official</Badge>
                        </div>
                        <CardDescription>Highest level of verification</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            Models run explicitly by the SynthArena team. We attest to the hardware, runtime, and
                            configuration.
                        </p>
                    </CardContent>
                </Card>

                <Card variant="bordered">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <CardTitle>Community Submission</CardTitle>
                            <Badge variant="secondary">Community</Badge>
                        </div>
                        <CardDescription>Author-submitted results</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            Models submitted by authors. The score is computationally verified against the provided
                            route data. The community can audit the specific routes for hallucinations.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </section>
    )
}
