import './env-loader'

import prisma from '@/lib/db'
import { parseEvaluationLabelOption, resolveEvaluationLabel } from '@/lib/evaluation-label'
import { solvRateKey, tierValidityRateKey, topKFromMetricKey } from '@/lib/retrocast-metrics'

// mapping from database instance slugs to readable display names
const MODEL_NAME_MAPPING: Record<string, string> = {
    // this mapping now uses INSTANCE SLUGS as keys, and FAMILY NAMES as values for display
    'askcos-v2-0-0': 'ASKCOS',
    'azf-m-v4-4-0': 'AiZynthFinder MCTS',
    'azf-mh-v4-4-0': 'AiZynthFinder MCTS (High)',
    'azf-r-v4-4-0': 'AiZynthFinder Retro*',
    'azf-rh-v4-4-0': 'AiZynthFinder Retro* (High)',
    'explorer-xl-v1-1-3': 'DMS Explorer XL',
    'og-r-v1-1-0': 'Retro*',
    'og-rh-v1-1-0': 'Retro* (High)',
    'synp-m-v1-2-0': 'SynPlanner MCTS Rollout',
    'synp-m-v1-3-2': 'SynPlanner MCTS Rollout',
    'synp-mv-v1-3-2': 'SynPlanner MCTS Val',
    'synp-v-v1-2-0': 'SynPlanner MCTS Val',
    'synp-nm-v1-3-2': 'SynPlanner NMCS',
    'synt-lr-v0-7-0': 'Syntheseus LocalRetro',
}

async function exportLatexTable(
    benchmarkId: string,
    evaluationLabel: string | undefined,
    includeTime: boolean,
    includeTimeRelative: boolean,
    includeCost: boolean
) {
    // Fetch statistics for the benchmark
    const allStatistics = await prisma.runEvaluation.findMany({
        where: {
            predictionRun: {
                benchmarkSetId: benchmarkId,
            },
        },
        include: {
            predictionRun: {
                include: {
                    benchmarkSet: { include: { _count: { select: { targets: true } } } },
                    modelInstance: {
                        include: {
                            family: true,
                        },
                    },
                },
            },
            metrics: {
                where: { stratum: '' },
            },
        },
        orderBy: {
            predictionRun: {
                modelInstance: {
                    family: {
                        name: 'asc',
                    },
                },
            },
        },
    })
    const selectedLabel = resolveEvaluationLabel(
        evaluationLabel,
        allStatistics.map((stat) => stat.metricLabel),
        benchmarkId
    )
    const statistics = allStatistics.filter((stat) => stat.metricLabel === selectedLabel)

    // Build format string based on flags
    let formatStr =
        '% Format: Model & Tier-0 & Solv-0 & Solv-0_lower & Solv-0_upper & Top-1 & Top-1_lower & Top-1_upper & Top-10 & Top-10_lower & Top-10_upper'
    if (includeTime) {
        formatStr += ' & Duration'
    }
    if (includeTimeRelative) {
        formatStr += ' & Time/Target'
    }
    if (includeCost) {
        formatStr += ' & Cost'
    }
    formatStr += ' \\\\'

    console.log('% LaTeX table for benchmark:', benchmarkId)
    console.log('% Evaluation label:', selectedLabel)
    console.log(formatStr)
    console.log()

    for (const stat of statistics) {
        const instanceSlug = stat.predictionRun.modelInstance.slug
        const modelName = MODEL_NAME_MAPPING[instanceSlug] || stat.predictionRun.modelInstance.family.name

        // Find metrics
        const metricsByName = new Map(stat.metrics.map((metric) => [metric.metricKey, metric]))
        const tier0 = metricsByName.get(tierValidityRateKey(0))
        const solvability = metricsByName.get(solvRateKey(0, stat.metricLabel))
        const top1 = stat.metrics.find((metric) => topKFromMetricKey(metric.metricKey) === 1)
        const top10 = stat.metrics.find((metric) => topKFromMetricKey(metric.metricKey) === 10)

        if (!tier0 || !solvability) {
            console.error(`Warning: No Tier-0/Solv-0 metric found for model ${modelName}`)
            continue
        }

        // Convert to percentages and format to 1 decimal place
        const formatMetric = (value: number) => (value * 100).toFixed(1)

        const solvValues = [
            formatMetric(tier0.value),
            formatMetric(solvability.value),
            formatMetric(solvability.ciLower ?? solvability.value),
            formatMetric(solvability.ciUpper ?? solvability.value),
        ]

        const top1Values = top1
            ? [
                  formatMetric(top1.value),
                  formatMetric(top1.ciLower ?? top1.value),
                  formatMetric(top1.ciUpper ?? top1.value),
              ]
            : ['--', '--', '--']

        const top10Values = top10
            ? [
                  formatMetric(top10.value),
                  formatMetric(top10.ciLower ?? top10.value),
                  formatMetric(top10.ciUpper ?? top10.value),
              ]
            : ['--', '--', '--']

        // Build row with base metrics
        const rowValues = [modelName, ...solvValues, ...top1Values, ...top10Values]

        // Add optional columns
        if (includeTime) {
            const duration = stat.predictionRun.totalWallTime
                ? (stat.predictionRun.totalWallTime / 60).toFixed(1)
                : '--'
            rowValues.push(duration)
        }

        if (includeTimeRelative) {
            const targetCount = stat.predictionRun.benchmarkSet._count.targets
            const timePerTarget =
                stat.predictionRun.totalWallTime && targetCount > 0
                    ? (stat.predictionRun.totalWallTime / targetCount).toFixed(1)
                    : '--'
            rowValues.push(timePerTarget)
        }

        if (includeCost) {
            const cost = stat.predictionRun.totalCost ? stat.predictionRun.totalCost.toFixed(2) : '--'
            rowValues.push(cost)
        }

        // Output LaTeX row
        console.log(`${rowValues.join(' & ')} \\\\`)
    }
}

// Parse command-line arguments
function parseArgs() {
    const { evaluationLabel, remainingArgs: args } = parseEvaluationLabelOption(process.argv.slice(2))
    let benchmarkId: string | null = null
    let includeTime = false
    let includeTimeRelative = false
    let includeCost = false

    for (const arg of args) {
        if (arg === '-t') {
            includeTime = true
        } else if (arg === '-trel') {
            includeTimeRelative = true
        } else if (arg === '-c') {
            includeCost = true
        } else if (!arg.startsWith('-')) {
            benchmarkId = arg
        }
    }

    return { benchmarkId, evaluationLabel, includeTime, includeTimeRelative, includeCost }
}

// Main execution
const { benchmarkId, evaluationLabel, includeTime, includeTimeRelative, includeCost } = parseArgs()

if (!benchmarkId) {
    console.error(
        'Usage: pnpm tsx scripts/export-latex-table.ts <benchmarkId> [--evaluation-label <label>] [-t] [-trel] [-c]'
    )
    console.error('  --evaluation-label  Select an exact label; required when the benchmark has multiple labels')
    console.error('  -t     Include total wall time (minutes)')
    console.error('  -trel  Include wall time per target (seconds/target)')
    console.error('  -c     Include total cost (USD)')
    process.exit(1)
}

exportLatexTable(benchmarkId, evaluationLabel, includeTime, includeTimeRelative, includeCost)
    .catch((e) => {
        console.error('Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
