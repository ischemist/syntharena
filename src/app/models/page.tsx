import { redirect } from 'next/navigation'

/**
 * Redirect /models to /algorithms.
 * Model instances are accessed via /models/[slug] but the list view
 * is accessed through the algorithm hierarchy at /algorithms.
 */
export default function ModelsPage() {
    redirect('/algorithms')
}
