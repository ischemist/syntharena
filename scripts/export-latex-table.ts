import './env-loader'

import prisma from '@/lib/db'

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
    includeTime: boolean,
    includeTimeRelative: boolean,
    includeCost: boolean
) {
    // Fetch statistics for the benchmark
    const statistics = await prisma.modelRunStatistics.findMany({
        where: {
            predictionRun: {
                benchmarkSetId: benchmarkId,
            },
        },
        include: {
            predictionRun: {
                include: {
                    modelInstance: {
                        include: {
                            family: true,
                        },
                    },
                },
            },
            benchmarkSet: {
                include: {
                    _count: {
                        select: { targets: true },
                    },
                },
            },
            metrics: {
                where: {
                    groupKey: null, // Only overall metrics
                    metricName: {
                        in: ['Solvability', 'Top-1', 'Top-10'],
                    },
                },
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

    // Build format string based on flags
    let formatStr =
        '% Format: Model & Solv & Solv_lower & Solv_upper & Top-1 & Top-1_lower & Top-1_upper & Top-10 & Top-10_lower & Top-10_upper'
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
    console.log(formatStr)
    console.log()

    for (const stat of statistics) {
        const instanceSlug = stat.predictionRun.modelInstance.slug
        const modelName = MODEL_NAME_MAPPING[instanceSlug] || stat.predictionRun.modelInstance.family.name

        // Find metrics
        const solvability = stat.metrics.find((m) => m.metricName === 'Solvability')
        const top1 = stat.metrics.find((m) => m.metricName === 'Top-1')
        const top10 = stat.metrics.find((m) => m.metricName === 'Top-10')

        if (!solvability) {
            console.error(`Warning: No solvability metric found for model ${modelName}`)
            continue
        }

        // Convert to percentages and format to 1 decimal place
        const formatMetric = (value: number) => (value * 100).toFixed(1)

        const solvValues = [
            formatMetric(solvability.value),
            formatMetric(solvability.ciLower),
            formatMetric(solvability.ciUpper),
        ]

        const top1Values = top1
            ? [formatMetric(top1.value), formatMetric(top1.ciLower), formatMetric(top1.ciUpper)]
            : ['--', '--', '--']

        const top10Values = top10
            ? [formatMetric(top10.value), formatMetric(top10.ciLower), formatMetric(top10.ciUpper)]
            : ['--', '--', '--']

        // Build row with base metrics
        const rowValues = [modelName, ...solvValues, ...top1Values, ...top10Values]

        // Add optional columns
        if (includeTime) {
            const duration = stat.totalWallTime ? (stat.totalWallTime / 60).toFixed(1) : '--'
            rowValues.push(duration)
        }

        if (includeTimeRelative) {
            const targetCount = stat.benchmarkSet._count.targets
            const timePerTarget =
                stat.totalWallTime && targetCount > 0 ? (stat.totalWallTime / targetCount).toFixed(1) : '--'
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
    const args = process.argv.slice(2)
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

    return { benchmarkId, includeTime, includeTimeRelative, includeCost }
}

// Main execution
const { benchmarkId, includeTime, includeTimeRelative, includeCost } = parseArgs()

if (!benchmarkId) {
    console.error('Usage: pnpm tsx scripts/export-latex-table.ts <benchmarkId> [-t] [-trel] [-c]')
    console.error('  -t     Include total wall time (minutes)')
    console.error('  -trel  Include wall time per target (seconds/target)')
    console.error('  -c     Include total cost (USD)')
    process.exit(1)
}

exportLatexTable(benchmarkId, includeTime, includeTimeRelative, includeCost)
    .catch((e) => {
        console.error('Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
