import { AlertTriangle } from 'lucide-react'

export function WhyStratified() {
    return (
        <div className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                    <h3 className="flex items-center gap-2 font-semibold">
                        <AlertTriangle className="size-4 text-yellow-600" />
                        Metric Insensitivity
                    </h3>
                    <p className="text-muted-foreground text-sm">
                        74% of routes in PaRoutes n5 are length 3-4. General metrics can mask significant performance
                        differences on longer routes (5+ steps) or specific topologies (linear vs. convergent).
                    </p>
                </div>

                <div className="space-y-2">
                    <h3 className="flex items-center gap-2 font-semibold">
                        <AlertTriangle className="size-4 text-yellow-600" />
                        Stock Definition
                    </h3>
                    <p className="text-muted-foreground text-sm">
                        Only ~46% of PaRoutes leaf molecules are in Buyables stock, suggesting many routes are arbitrary
                        fragments cut off where patent descriptions ended.
                    </p>
                </div>
            </div>

            <p className="text-muted-foreground text-sm">
                <strong>Validation:</strong> We used seed stability analysis across 15 candidate subsets to ensure each
                benchmark is internally representative and minimizes variance.
            </p>
        </div>
    )
}
