import * as stockView from '@/lib/services/view/stock.view'

import { MoleculeSearchBar } from '../client/molecule-search-bar'

interface MoleculeFilterBarProps {
    stockId: string
}

/**
 * Server component that fetches stock filter stats and renders the filter toolbar.
 * Displays search and filter controls for browsing stock molecules.
 * Handles data fetching so client component can focus on interactivity.
 */
export async function MoleculeFilterBar({ stockId }: MoleculeFilterBarProps) {
    const filters = await stockView.getStockMoleculeFilters(stockId)

    return (
        <MoleculeSearchBar
            availableVendors={filters.availableVendors}
            totalCount={filters.counts.total}
            buyableCount={filters.counts.buyable}
        />
    )
}
