export function EvaluationTrackSection() {
    return (
        <section className="space-y-6">
            <h2 className="text-2xl font-bold">Evaluation as a Research Track</h2>
            <p className="leading-relaxed">
                In the early stages of a scientific discipline, it is natural for researchers to define both the method
                and the metric. However, as retrosynthesis transitions from proof-of-concept to practical utility, this
                coupling becomes a bottleneck. Even assuming universal good faith, the continuous introduction of ad-hoc
                metrics makes it impossible to distinguish genuine architectural progress from variance in evaluation
                protocols.
            </p>

            <p className="leading-relaxed">
                Other fields addressed this through institutional separation. GLUE and SuperGLUE were developed by
                independent teams; CASP has operated as an independent biennial competition since 1994; ImageNet and
                COCO challenges were organized by academic labs separate from competing teams.
            </p>

            <div className="border-primary border-l-4 py-2 pl-6">
                <p className="font-medium">
                    We propose that retrosynthesis—and computational chemistry more broadly—formally recognize
                    evaluation as a distinct research track responsible for maintaining stable benchmarks, developing
                    consensus metrics, and ensuring that progress claims are measured against community-vetted
                    standards.
                </p>
            </div>

            <p className="leading-relaxed">
                This means versioned, frozen evaluation sets; shared data splits with detectable leakage; living
                leaderboards that provide standardized metrics for all submissions; and independent research on
                plausibility scoring, diversity measures, and cost estimation.
            </p>

            <div className="border-primary border-l-4 py-2 pl-6">
                <p className="font-medium">Progress begins with measurement.</p>
            </div>
        </section>
    )
}
