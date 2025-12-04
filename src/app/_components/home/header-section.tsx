import Link from 'next/link'

export function HeaderSection() {
    return (
        <header className="border-b pb-8">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight">SynthArena</h1>
                    <p className="text-muted-foreground mt-2 text-lg">
                        A Unified Evaluation Framework for AI-Driven Retrosynthesis
                    </p>
                </div>
                <div className="flex gap-4 text-sm">
                    <Link
                        href="https://github.com/ischemist/retrocast"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        RetroCast
                    </Link>
                    <Link
                        href="https://github.com/ischemist/syntharena"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        GitHub
                    </Link>
                    <span className="text-muted-foreground">MIT License</span>
                </div>
            </div>
        </header>
    )
}
