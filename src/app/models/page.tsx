import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
    title: 'Models',
    description: 'Model listings now live under Algorithms; this route redirects for compatibility.',
}

/**
 * Redirect /models to /algorithms.
 * Model instances are accessed via /models/[slug] but the list view
 * is accessed through the algorithm hierarchy at /algorithms.
 */
export default function ModelsPage() {
    redirect('/algorithms')
}
