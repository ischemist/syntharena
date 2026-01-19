import { redirect } from 'next/navigation'

/**
 * Redirect /instances to /models.
 * Model instances are accessed via /instances/[slug] but the list view
 * is accessed through the algorithm hierarchy at /models.
 */
export default function ModelsPage() {
    redirect('/models')
}
