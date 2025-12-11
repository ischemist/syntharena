import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'

export function AdapterExplanationSection() {
    return (
        <section className="space-y-6">
            <div>
                <h2 className="mb-3 text-2xl font-bold">The Adapter Layer</h2>
                <p>
                    Different retrosynthesis models produce output in vastly different formats. Comparing them directly
                    would require writing custom evaluation code for each model—a recipe for inconsistency and bugs.
                </p>
            </div>

            <div className="space-y-4">
                <p>
                    <strong>The Problem:</strong> Each retrosynthesis model represents synthesis routes differently—some
                    use string-based precursor maps, others use recursive dictionaries or explicit graph structures.
                    Without a common format, comparing these models fairly would require custom evaluation code for each
                    format, leading to bugs and inconsistent metrics.
                </p>
            </div>

            <div className="space-y-4">
                <p>
                    <strong>The Solution:</strong> RetroCast introduces an adapter layer that sits between the model and
                    the evaluation pipeline:
                </p>

                <Card className="bg-muted/50">
                    <CardContent className="px-4">
                        <div className="flex items-center justify-between gap-4 text-sm">
                            <div className="flex-1 text-center">
                                <div className="bg-background mb-2 rounded-lg border p-3">
                                    <div className="font-mono text-xs">Model Output</div>
                                    <div className="text-muted-foreground text-xs">(Native Format)</div>
                                </div>
                            </div>
                            <div className="text-muted-foreground">→</div>
                            <div className="flex-1 text-center">
                                <div className="border-primary mb-2 rounded-lg border p-3">
                                    <div className="font-mono text-xs">Adapter</div>
                                    <div className="text-muted-foreground text-xs">(Translation Layer)</div>
                                </div>
                            </div>
                            <div className="text-muted-foreground">→</div>
                            <div className="flex-1 text-center">
                                <div className="bg-background mb-2 rounded-lg border p-3">
                                    <div className="font-mono text-xs">Canonical Routes</div>
                                    <div className="text-muted-foreground text-xs">(Standard Schema)</div>
                                </div>
                            </div>
                            <div className="text-muted-foreground">→</div>
                            <div className="flex-1 text-center">
                                <div className="bg-background mb-2 rounded-lg border p-3">
                                    <div className="font-mono text-xs">Evaluation</div>
                                    <div className="text-muted-foreground text-xs">(Metrics & Analysis)</div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Alert>
                    <AlertDescription>
                        <strong>Key insight:</strong> The evaluation pipeline only sees standardized Route objects. It
                        has no knowledge of the original model format, ensuring identical metric calculations across all
                        models.
                    </AlertDescription>
                </Alert>
            </div>

            <div className="space-y-4">
                <p>
                    <strong>What This Means for You:</strong>
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                    <Card variant="bordered">
                        <CardContent className="px-4 py-2">
                            <p className="text-sm">
                                <strong>Model Developers:</strong> You don&apos;t need to change your model&apos;s
                                output format. Just write an adapter (or use an existing one) to translate to the
                                canonical schema. Extra data can be preserved in metadata fields.
                            </p>
                        </CardContent>
                    </Card>
                    <Card variant="bordered">
                        <CardContent className="px-4 py-2">
                            <p className="text-sm">
                                <strong>Users & Researchers:</strong> All models are evaluated using identical logic,
                                ensuring fair, apples-to-apples comparisons across the entire leaderboard. No hidden
                                biases from format differences.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </section>
    )
}
