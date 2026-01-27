import type { ModelInstanceExecutiveSummary } from '@/types'

interface ModelExecutiveSummaryProps {
    summary: ModelInstanceExecutiveSummary
    variant?: 'minimal' | 'bordered' | 'pills' | 'underline'
}

function getStats(summary: ModelInstanceExecutiveSummary) {
    return [
        {
            label: 'Avg Cost/1M',
            value:
                summary.avgCostPerCompound != null
                    ? `$${(summary.avgCostPerCompound * 1_000_000).toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                      })}`
                    : '—',
        },
        {
            label: 'Duration',
            value: summary.avgDurationPerCompound != null ? `${summary.avgDurationPerCompound.toFixed(1)}s` : '—',
        },
        {
            label: 'Runs',
            value: summary.totalRuns.toString(),
        },
        {
            label: 'Benchmarks',
            value: summary.benchmarkCount.toString(),
        },
        ...(summary.bestTop10Accuracy
            ? [
                  {
                      label: 'Best Top-10',
                      value: `${(summary.bestTop10Accuracy.value * 100).toFixed(1)}%`,
                      ci: `[${(summary.bestTop10Accuracy.ciLower * 100).toFixed(1)}–${(summary.bestTop10Accuracy.ciUpper * 100).toFixed(1)}%]`,
                  },
              ]
            : []),
    ]
}

// Variation A: Pure minimal - just typography, no backgrounds
function MinimalVariant({ summary }: { summary: ModelInstanceExecutiveSummary }) {
    const stats = getStats(summary)
    return (
        <div className="flex items-center gap-8">
            {stats.map((stat) => (
                <div key={stat.label} className="flex items-baseline gap-2">
                    <span className="text-foreground text-xl font-medium tabular-nums">{stat.value}</span>
                    {'ci' in stat && <span className="text-muted-foreground/50 text-xs">{stat.ci}</span>}
                    <span className="text-muted-foreground/70 text-xs">{stat.label}</span>
                </div>
            ))}
        </div>
    )
}

// Variation B: Bordered - subtle border wrapper, clean dividers
function BorderedVariant({ summary }: { summary: ModelInstanceExecutiveSummary }) {
    const stats = getStats(summary)
    return (
        <div className="border-border divide-border inline-flex items-center divide-x rounded-md border">
            {stats.map((stat) => (
                <div key={stat.label} className="flex items-baseline gap-2 px-5 py-3">
                    <span className="text-foreground text-lg font-semibold tabular-nums">{stat.value}</span>
                    {'ci' in stat && <span className="text-muted-foreground/50 text-[10px]">{stat.ci}</span>}
                    <span className="text-muted-foreground text-[11px] tracking-wide uppercase">{stat.label}</span>
                </div>
            ))}
        </div>
    )
}

// Variation C: Pills - each stat in its own subtle pill
function PillsVariant({ summary }: { summary: ModelInstanceExecutiveSummary }) {
    const stats = getStats(summary)
    return (
        <div className="flex items-center gap-2">
            {stats.map((stat) => (
                <div key={stat.label} className="bg-muted/60 flex items-baseline gap-1.5 rounded-full px-4 py-2">
                    <span className="text-foreground text-sm font-semibold tabular-nums">{stat.value}</span>
                    {'ci' in stat && <span className="text-muted-foreground/50 text-[9px]">{stat.ci}</span>}
                    <span className="text-muted-foreground text-[10px]">{stat.label}</span>
                </div>
            ))}
        </div>
    )
}

// Variation D: Underline accent - value with underline, label below
function UnderlineVariant({ summary }: { summary: ModelInstanceExecutiveSummary }) {
    const stats = getStats(summary)
    return (
        <div className="flex items-start gap-10">
            {stats.map((stat) => (
                <div key={stat.label} className="flex flex-col">
                    <div className="border-foreground/20 flex items-baseline gap-2 border-b-2 pb-1">
                        <span className="text-foreground text-2xl font-light tabular-nums">{stat.value}</span>
                        {'ci' in stat && <span className="text-muted-foreground/50 text-xs">{stat.ci as string}</span>}
                    </div>
                    <span className="text-muted-foreground mt-2 text-[10px] tracking-widest uppercase">
                        {stat.label}
                    </span>
                </div>
            ))}
        </div>
    )
}

/**
 * Server component displaying executive summary statistics for a model instance.
 * Shows average cost/duration per compound, run count, benchmark count, and best Top-10 accuracy.
 */
export function ModelExecutiveSummary({ summary, variant = 'minimal' }: ModelExecutiveSummaryProps) {
    if (summary.totalRuns === 0) {
        return null
    }

    const variants = {
        minimal: <MinimalVariant summary={summary} />,
        bordered: <BorderedVariant summary={summary} />,
        pills: <PillsVariant summary={summary} />,
        underline: <UnderlineVariant summary={summary} />,
    }

    return (
        <div className="space-y-3">
            <h2 className="text-muted-foreground text-sm font-medium tracking-wider uppercase">Executive Summary</h2>
            {variants[variant]}
        </div>
    )
}
