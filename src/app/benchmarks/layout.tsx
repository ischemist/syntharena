import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Benchmarks',
    description: 'Browse and explore retrosynthesis benchmark datasets',
}

export default function BenchmarksLayout({ children }: { children: React.ReactNode }) {
    return <div className="container mx-auto px-4 py-2">{children}</div>
}
