import Link from 'next/link'

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function NavigationSection() {
    return (
        <section className="border-t py-8">
            <h2 className="mb-4 text-2xl font-semibold">Explore</h2>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                <Link href="/benchmarks" className="h-full">
                    <Card variant="clickable" className="h-full">
                        <CardHeader>
                            <CardTitle>Benchmarks</CardTitle>
                            <CardDescription>Browse all evaluation sets and targets</CardDescription>
                        </CardHeader>
                    </Card>
                </Link>
                <Link href="/leaderboard" className="h-full">
                    <Card variant="clickable" className="h-full">
                        <CardHeader>
                            <CardTitle>Leaderboard</CardTitle>
                            <CardDescription>Compare model performance with confidence intervals</CardDescription>
                        </CardHeader>
                    </Card>
                </Link>
                <Link href="/runs" className="h-full">
                    <Card variant="clickable" className="h-full">
                        <CardHeader>
                            <CardTitle>Prediction Runs</CardTitle>
                            <CardDescription>Inspect individual routes and predictions</CardDescription>
                        </CardHeader>
                    </Card>
                </Link>
                <Link href="/stocks" className="h-full">
                    <Card variant="clickable" className="h-full">
                        <CardHeader>
                            <CardTitle>Stock Sets</CardTitle>
                            <CardDescription>View available starting materials</CardDescription>
                        </CardHeader>
                    </Card>
                </Link>
            </div>
        </section>
    )
}
