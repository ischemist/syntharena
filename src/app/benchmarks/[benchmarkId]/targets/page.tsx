import { use } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
    title: 'Benchmark Targets',
    description: 'Target browsing lives on the parent benchmark page; this route redirects for compatibility.',
}

interface TargetsPageProps {
    params: Promise<{ benchmarkId: string }>
}

/**
 * Empty targets page that redirects to the parent benchmark page.
 * The benchmark page contains the target grid and filtering.
 */
export default function TargetsPage(props: TargetsPageProps) {
    const params = use(props.params)
    const { benchmarkId } = params

    redirect(`/benchmarks/${benchmarkId}`)
}
