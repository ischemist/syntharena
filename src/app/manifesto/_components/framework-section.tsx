export function FrameworkSection() {
    return (
        <section className="space-y-6">
            <h2 className="text-3xl font-bold">Two Classes of Problems</h2>

            <p className="leading-relaxed">
                Machine learning is applied to two fundamentally different classes of scientific problems:{' '}
                <strong>quantitative</strong> and <strong>structural</strong>.
            </p>

            <div className="space-y-4">
                <div>
                    <h3 className="mb-2 text-xl font-semibold">Quantitative Problems</h3>
                    <p className="leading-relaxed">
                        These are defined by scalar targets and often constrained by data scarcity. Examples include
                        predicting drug toxicity, binding affinity, or solubility. They are analogous to early NLP
                        challenges like sentiment analysis—supervised learning on limited labeled datasets.
                    </p>
                </div>

                <div>
                    <h3 className="mb-2 text-xl font-semibold">Structural Problems</h3>
                    <p className="leading-relaxed">
                        These require generating complex objects governed by an underlying grammar. Examples include
                        language modeling (generating coherent text) and protein folding (predicting 3D structure from
                        sequence). These problems are harder, but their solutions are transformative.
                    </p>
                </div>
            </div>

            <div className="bg-muted/50 space-y-3 rounded-lg p-6">
                <h3 className="text-xl font-semibold">The Empirical Pattern</h3>
                <p className="leading-relaxed">
                    The most significant AI breakthroughs—GPT-4, AlphaFold, DALL-E—emerged from solving structural
                    problems. More importantly, foundation models trained on structural tasks solve quantitative
                    problems as emergent capabilities.
                </p>
                <p className="leading-relaxed">
                    GPT-4 achieves state-of-the-art sentiment analysis without being trained on sentiment labels.
                    AlphaFold enables structure-based drug design as a side effect of mastering protein structure
                    prediction.
                </p>
            </div>

            <p className="leading-relaxed font-medium">
                The pattern suggests a principle:{' '}
                <em>mastery of structure is a prerequisite for solving downstream quantitative tasks</em>.
            </p>

            <p className="leading-relaxed">
                If this principle holds—and the evidence from natural language processing and structural biology
                suggests it does—then chemistry&apos;s path to foundation models runs through its paramount structural
                challenge.
            </p>
        </section>
    )
}
