import { redirect } from 'next/navigation'

/**
 * redirect /model-families to /algorithms.
 * model families are accessed via /model-families/[slug] but the list view
 * is accessed through the algorithm hierarchy at /algorithms.
 */
export default function ModelFamiliesPage() {
    redirect('/algorithms')
}
