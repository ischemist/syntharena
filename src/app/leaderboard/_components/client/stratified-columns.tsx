'use client'

import { ColumnDef } from '@tanstack/react-table'

import type { MetricResult, StratifiedMetric } from '@/types'
import { MetricCell } from '@/components/metrics'

import { DataTableColumnHeader } from './data-table-column-header'

/**
 * Row data type for stratified metrics table.
 * Each row represents one model with metrics across different route lengths.
 */
export type StratifiedMetricRow = {
    modelName: string
    metricsByLength: Record<number, MetricResult | undefined>
}

/**
 * Creates column definitions for stratified metrics tables.
 * Includes model name column and dynamic route length columns.
 *
 * @param routeLengths - Array of route lengths to create columns for (e.g., [1, 2, 3, 4])
 */
export function createStratifiedColumns(routeLengths: number[]): ColumnDef<StratifiedMetricRow>[] {
    const columns: ColumnDef<StratifiedMetricRow>[] = [
        // Model Name Column
        {
            accessorKey: 'modelName',
            id: 'modelName',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Model" />,
            cell: ({ row }) => <div className="font-medium">{row.getValue('modelName')}</div>,
        },
    ]

    // Add route length columns dynamically
    routeLengths.forEach((length, idx) => {
        const isLastColumn = idx === routeLengths.length - 1

        columns.push({
            id: `length-${length}`,
            accessorFn: (row) => row.metricsByLength[length]?.value,
            header: ({ column }) => <DataTableColumnHeader column={column} title={`Length ${length}`} />,
            cell: ({ row }) => {
                const metric = row.original.metricsByLength[length]
                return (
                    <div className={isLastColumn ? 'flex justify-center pr-24' : 'flex justify-center'}>
                        {metric ? <MetricCell metric={metric} showBadge /> : '-'}
                    </div>
                )
            },
            sortingFn: (rowA, rowB) => {
                const a = rowA.original.metricsByLength[length]?.value ?? -1
                const b = rowB.original.metricsByLength[length]?.value ?? -1
                return a - b
            },
        })
    })

    return columns
}

/**
 * Transforms stratified metrics data into table rows.
 *
 * @param metricsMap - Map of model names to their stratified metrics
 * @param metricName - Name of the metric to extract (e.g., "Solvability", "Top-1")
 */
export function transformStratifiedData(
    metricsMap: Map<
        string,
        {
            solvability: StratifiedMetric
            topKAccuracy?: Record<string, StratifiedMetric>
        }
    >,
    metricName: string
): StratifiedMetricRow[] {
    return Array.from(metricsMap.entries()).map(([modelName, metrics]) => {
        let metricsByLength: Record<number, MetricResult | undefined> = {}

        if (metricName === 'Solvability') {
            metricsByLength = Object.fromEntries(
                Object.entries(metrics.solvability.byGroup).map(([length, metric]) => [parseInt(length), metric])
            )
        } else {
            const topKMetric = metrics.topKAccuracy?.[metricName]
            if (topKMetric) {
                metricsByLength = Object.fromEntries(
                    Object.entries(topKMetric.byGroup).map(([length, metric]) => [parseInt(length), metric])
                )
            }
        }

        return {
            modelName,
            metricsByLength,
        }
    })
}
