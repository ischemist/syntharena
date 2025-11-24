import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Stocks | SynthArena',
    description: 'Browse and search chemical stock libraries',
}

export default function StocksLayout({ children }: { children: React.ReactNode }) {
    return <div className="container mx-auto py-6">{children}</div>
}
