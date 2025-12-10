export function ValiditySection() {
    return (
        <section className="space-y-6">
            <h2 className="text-3xl font-bold">What Remains Unsolved</h2>

            <p className="leading-relaxed">
                Our multi-ground-truth evaluation is an improvement over rigid single-reference benchmarks, but we must
                be clear about its limitations.
            </p>

            <div className="bg-muted/50 space-y-3 rounded-lg p-6">
                <h3 className="text-xl font-semibold">The Fundamental Constraint</h3>
                <p className="leading-relaxed">
                    Multi-ground-truth evaluation can reward valid <em>subsets</em> of known routes. It cannot reward{' '}
                    <strong>novel</strong> but chemically valid pathways.
                </p>
                <p className="leading-relaxed">
                    A model that discovers a shorter, more efficient synthesis—using different chemistry than the
                    experimental reference—is still penalized as incorrect. This is a measurement limitation, not a
                    model failure.
                </p>
            </div>

            <div className="space-y-4">
                <h3 className="text-xl font-semibold">Why Chemical Plausibility Is Hard</h3>
                <p className="leading-relaxed">Proposed solutions have significant drawbacks:</p>
                <ul className="space-y-2">
                    <li className="leading-relaxed">
                        <strong>Forward model confidence scores:</strong> Inherit the biases of the forward predictor.
                        High confidence does not guarantee chemical validity.
                    </li>
                    <li className="leading-relaxed">
                        <strong>Round-trip accuracy:</strong> Computationally expensive and still model-dependent. Does
                        not provide interpretable explanations.
                    </li>
                    <li className="leading-relaxed">
                        <strong>Expert human annotation:</strong> Gold standard but does not scale. Cannot be applied to
                        millions of predictions.
                    </li>
                </ul>
            </div>

            <p className="leading-relaxed">
                This is not an implementation detail. This is a <strong>research problem</strong>. Developing metrics
                that can distinguish chemically sound novel routes from implausible artifacts is perhaps the most
                important open question in retrosynthesis evaluation.
            </p>

            <div className="border-primary border-l-4 py-2 pl-6">
                <p className="text-lg font-medium">
                    We release the complete, standardized prediction database from 10+ models not as final answers, but
                    as a substrate for developing plausibility metrics.
                </p>
            </div>

            <p className="leading-relaxed">
                By decoupling metric development from the computational cost of running models, we enable rapid
                iteration. Researchers can prototype new scoring functions, test them on thousands of predictions, and
                compare against human expert judgments—without waiting days for model execution.
            </p>

            <div className="space-y-3">
                <h3 className="text-xl font-semibold">A Path Forward: Community Curation</h3>
                <p className="leading-relaxed">
                    SynthArena can be extended beyond passive visualization into active, distributed error annotation.
                    Chemists can flag specific reaction steps as implausible, categorize the type of invalidity (mass
                    balance, mechanism, stereochemistry), and build a curated dataset of &ldquo;chemical bugs.&rdquo;
                </p>
                <p className="leading-relaxed">
                    This transforms evaluation from a top-down benchmark into a bottom-up, adversarial process—chemical
                    bug bounties for retrosynthesis models.
                </p>
            </div>

            <p className="leading-relaxed font-medium">
                The community must solve this problem together. The infrastructure is ready. The data is public. The
                work begins now.
            </p>
        </section>
    )
}
