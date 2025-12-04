import Link from 'next/link'

import { Button } from '@/components/ui/button'

export function NavigationSection() {
    return (
        <section className="border-t py-8">
            <h2 className="mb-4 text-2xl font-semibold">Explore</h2>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                <Link href="/benchmarks">
                    <Button variant="outline" className="h-auto w-full flex-col items-start gap-1 py-4 text-left">
                        <span className="font-semibold">Benchmarks</span>
                        <span className="text-muted-foreground text-xs font-normal">
                            Browse all evaluation sets and targets
                        </span>
                    </Button>
                </Link>
                <Link href="/leaderboard">
                    <Button variant="outline" className="h-auto w-full flex-col items-start gap-1 py-4 text-left">
                        <span className="font-semibold">Leaderboard</span>
                        <span className="text-muted-foreground text-xs font-normal">
                            Compare model performance with confidence intervals
                        </span>
                    </Button>
                </Link>
                <Link href="/runs">
                    <Button variant="outline" className="h-auto w-full flex-col items-start gap-1 py-4 text-left">
                        <span className="font-semibold">Prediction Runs</span>
                        <span className="text-muted-foreground text-xs font-normal">
                            Inspect individual routes and predictions
                        </span>
                    </Button>
                </Link>
                <Link href="/stocks">
                    <Button variant="outline" className="h-auto w-full flex-col items-start gap-1 py-4 text-left">
                        <span className="font-semibold">Stock Sets</span>
                        <span className="text-muted-foreground text-xs font-normal">
                            View available starting materials
                        </span>
                    </Button>
                </Link>
            </div>
        </section>
    )
}
