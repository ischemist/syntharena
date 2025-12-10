export function EvaluationTrackSection() {
    return (
        <section className="space-y-6">
            <h2 className="text-3xl font-bold">A Proposal: Evaluation as a Research Track</h2>

            <p className="leading-relaxed">
                The current paradigm creates a subtle but critical incentive misalignment.
            </p>

            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/20">
                <h3 className="text-xl font-semibold text-amber-900 dark:text-amber-100">The Problem</h3>
                <p className="leading-relaxed text-amber-900 dark:text-amber-100">
                    Methods papers often propose new evaluation metrics alongside their models. The metrics are then
                    used to demonstrate the model&apos;s superiority. This is not scientific misconduct—it is rational
                    behavior under current norms—but it creates a situation where metrics are optimized for specific
                    methods rather than for truth.
                </p>
            </div>

            <div className="space-y-4">
                <h3 className="text-xl font-semibold">Precedents for Separation</h3>
                <p className="leading-relaxed">Other fields have addressed this through institutional separation:</p>
                <ul className="list-inside list-disc space-y-2">
                    <li className="leading-relaxed">
                        <strong>Natural Language Processing:</strong> The GLUE and SuperGLUE benchmarks were developed
                        by independent teams, not by the groups proposing models. This creates a neutral evaluation
                        ground.
                    </li>
                    <li className="leading-relaxed">
                        <strong>Structural Biology:</strong> CASP (Critical Assessment of protein Structure Prediction)
                        has operated as an independent biennial competition since 1994. Predictors and assessors are
                        distinct roles.
                    </li>
                    <li className="leading-relaxed">
                        <strong>Computer Vision:</strong> ImageNet and COCO challenges were organized by academic labs
                        separate from the industrial teams competing on them.
                    </li>
                </ul>
            </div>

            <div className="border-primary space-y-3 border-l-4 py-2 pl-6">
                <p className="text-lg font-semibold">
                    We propose that retrosynthesis—and computational chemistry more broadly—formally recognize
                    evaluation as a distinct research track.
                </p>
                <p className="leading-relaxed">
                    This track would be responsible for maintaining stable benchmarks, developing consensus metrics, and
                    ensuring that progress claims are measured against community-vetted standards—not ad-hoc criteria.
                </p>
            </div>

            <div className="space-y-3">
                <h3 className="text-xl font-semibold">What This Means in Practice</h3>
                <ul className="list-inside list-decimal space-y-2">
                    <li className="leading-relaxed">
                        <strong>Stable benchmarks:</strong> Evaluation sets are versioned and frozen. New models are
                        compared on identical tasks.
                    </li>
                    <li className="leading-relaxed">
                        <strong>Shared data splits:</strong> Training sets exclude evaluation targets. Data leakage
                        becomes detectable and unacceptable.
                    </li>
                    <li className="leading-relaxed">
                        <strong>Living leaderboards:</strong> Continuous integration for the field. Submit predictions,
                        receive standardized metrics, compare against all prior work.
                    </li>
                    <li className="leading-relaxed">
                        <strong>Metric development:</strong> Plausibility scoring, diversity measures, and cost
                        estimation become independent research problems with their own publication venues.
                    </li>
                </ul>
            </div>

            <p className="leading-relaxed">
                This is not a call for bureaucracy. It is a call for rigor. For the same standards that enabled progress
                in NLP, vision, and biology to be applied to chemistry.
            </p>

            <div className="bg-muted/50 space-y-3 rounded-lg p-6">
                <h3 className="text-xl font-semibold">The Vision</h3>
                <p className="leading-relaxed">
                    A future where retrosynthesis models are trained on standardized, publicly available data. Evaluated
                    on community-maintained benchmarks. Ranked by metrics developed through independent research. And
                    where progress is measured not in isolated papers, but in a shared, continuously updated
                    understanding of the state of the art.
                </p>
            </div>

            <div className="space-y-3 border-t pt-6">
                <p className="text-lg font-medium">This is the work.</p>
                <p className="leading-relaxed">
                    The field will measure its way to structural mastery. One benchmark at a time. One invalid route
                    flagged at a time. One better metric proposed at a time.
                </p>
                <p className="leading-relaxed">
                    RetroCast is an invitation to participate in this process. The infrastructure is public. The data is
                    open. The standards are transparent.
                </p>
                <p className="leading-relaxed font-medium">Progress begins with measurement.</p>
            </div>
        </section>
    )
}
