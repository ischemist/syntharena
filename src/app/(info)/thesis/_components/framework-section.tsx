export function FrameworkSection() {
    return (
        <section className="space-y-6">
            <h2 className="text-2xl font-bold">Two Classes of Problems</h2>

            <p className="leading-relaxed">
                We distinguish between two fundamental classes of scientific problems to which machine learning is
                applied: quantitative and structural. <strong>Quantitative problems</strong> predict scalar targets from
                limited labeled data (drug toxicity, binding affinity, solubility). <strong>Structural problems</strong>{' '}
                generate complex objects governed by underlying grammar (language modeling, protein folding, image
                generation).
            </p>

            <p className="leading-relaxed">
                The most significant AI breakthroughs (GPT-4, AlphaFold) emerged from solving structural problems.
                Foundation models trained on structural tasks solve quantitative problems as emergent capabilities:
                GPT-4 achieves state-of-the-art sentiment analysis without being trained on sentiment labels; AlphaFold
                enables structure-based drug design as a side effect of mastering protein structure prediction.
            </p>

            <div className="border-primary border-l-4 py-2 pl-6">
                <p className="font-medium">
                    Mastery of structure is a prerequisite for solving downstream quantitative tasks.
                </p>
            </div>

            <p className="leading-relaxed">
                If this principle holds then chemistry&apos;s path to foundation models runs through its paramount
                structural challenge.
            </p>
        </section>
    )
}
