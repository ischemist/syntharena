import { use } from 'react'
import { redirect } from 'next/navigation'

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
