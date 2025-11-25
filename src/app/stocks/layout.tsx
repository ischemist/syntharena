import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Stocks',
    description: 'Browse and search chemical stock libraries',
}

export default function StocksLayout({ children }: { children: React.ReactNode }) {
    return <div className="container mx-auto px-4 py-2">{children}</div>
}
