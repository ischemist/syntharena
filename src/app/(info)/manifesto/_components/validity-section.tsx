export function ValiditySection() {
    return (
        <section className="space-y-6">
            <h2 className="text-2xl font-bold">What Remains Unsolved</h2>

            <p className="leading-relaxed">
                Developing metrics that can distinguish chemically sound novel routes from implausible artifacts is
                perhaps the most important open question in retrosynthesis evaluation. Accuracy of reference route
                reproduction penalizes discovery of novel pathways; forward model confidence scores and round-trip
                accuracy inherit predictor biases; expert human annotation does not scale to millions of predictions.
            </p>

            <div className="border-primary border-l-4 py-2 pl-6">
                <p className="font-medium">
                    We release the complete, standardized prediction database from 10+ models as a substrate for
                    developing plausibility metrics.
                </p>
            </div>

            <div className="bg-muted rounded-lg p-4">
                <p className="mb-2 text-sm font-medium">Download the latest database:</p>
                <pre className="bg-background overflow-x-auto rounded border p-3">
                    <code className="text-sm">
                        curl -fsSL https://files.ischemist.com/syntharena/get-db.sh | bash -s
                    </code>
                </pre>
            </div>

            <p className="leading-relaxed">
                SynthArena could be extended into active, distributed error annotation: expert chemists flag implausible
                reaction steps, categorize invalidity types (mass balance, mechanism, stereochemistry), and build
                curated datasets of chemical bugs. This would transform evaluation from a top-down benchmark into a
                bottom-up, adversarial process. If there&apos;s interest from the community, we are prepared to build
                this out with authenticated expert access.
            </p>
        </section>
    )
}
