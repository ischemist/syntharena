export function HeroSection() {
    return (
        <header className="space-y-8">
            <div className="space-y-4">
                <p className="text-muted-foreground text-sm tracking-wide uppercase">Manifesto</p>
                <h1 className="text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
                    The most transformative successes in artificial intelligence have a common pattern.
                </h1>
                <p className="text-muted-foreground text-2xl font-normal">
                    They solved structural problems, not quantitative ones.
                </p>
            </div>

            <div className="border-muted border-l-4 py-2 pl-6">
                <p className="text-muted-foreground text-xl leading-relaxed font-normal italic">
                    &ldquo;A model cannot judge the difficulty of a journey it cannot first articulate.&rdquo;
                </p>
            </div>

            <p className="text-muted-foreground text-lg leading-relaxed">
                This document presents a thesis: that retrosynthesis—the ability to design valid synthetic pathways to
                molecules—may be the paramount structural challenge in machine learning for chemistry. What follows is
                not a vision statement, but a chain of reasoning. Each claim builds on observable patterns in AI history
                and the logical structure of chemical problems.
            </p>
        </header>
    )
}
