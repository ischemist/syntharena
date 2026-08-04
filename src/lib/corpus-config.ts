import type { BenchmarkSeries } from '@prisma/client'

export interface CorpusStockConfig {
    name: string
    description: string
}

export interface CorpusBenchmarkConfig {
    name: string
    stock: string
    series: BenchmarkSeries
}

export interface CorpusModelConfig {
    artifactName: string
    algorithm: { name: string; slug: string }
    family: { name: string; slug: string }
    instance: { slug: string; version: [number, number, number] }
}

export const CORPUS_STOCKS: CorpusStockConfig[] = [
    {
        name: 'buyables-stock',
        description: 'Commercially available compounds curated by the ASKCOS team.',
    },
    { name: 'n5-stock', description: 'All leaves represented in the PaRoutes n5 evaluation set.' },
    { name: 'n1-n5-stock', description: 'All leaves represented in the PaRoutes n1 and n5 evaluation sets.' },
]

export const CORPUS_BENCHMARKS: CorpusBenchmarkConfig[] = [
    { name: 'mkt-cnv-160', stock: 'buyables-stock', series: 'MARKET' },
    { name: 'mkt-lin-500', stock: 'buyables-stock', series: 'MARKET' },
    { name: 'ref-cnv-400', stock: 'n5-stock', series: 'REFERENCE' },
    { name: 'ref-lin-600', stock: 'n5-stock', series: 'REFERENCE' },
    { name: 'ref-lng-84', stock: 'n1-n5-stock', series: 'REFERENCE' },
    { name: 'uspto-190', stock: 'buyables-stock', series: 'LEGACY' },
]

const model = (
    artifactName: string,
    algorithm: [string, string],
    family: [string, string],
    instance: [string, number, number, number]
): CorpusModelConfig => ({
    artifactName,
    algorithm: { name: algorithm[0], slug: algorithm[1] },
    family: { name: family[0], slug: family[1] },
    instance: { slug: instance[0], version: [instance[1], instance[2], instance[3]] },
})

export const CORPUS_MODELS: CorpusModelConfig[] = [
    model(
        'aizynthfinder-mcts',
        ['AiZynthFinder', 'aizynthfinder-retro'],
        ['AiZynthFinder MCTS', 'aizynthfinder-mcts'],
        ['azf-m-v4-4-0', 4, 4, 0]
    ),
    model(
        'aizynthfinder-mcts-high',
        ['AiZynthFinder', 'aizynthfinder-retro'],
        ['AiZynthFinder MCTS (High)', 'aizynthfinder-mcts-high'],
        ['azf-mh-v4-4-0', 4, 4, 0]
    ),
    model(
        'aizynthfinder-retro-star',
        ['AiZynthFinder', 'aizynthfinder-retro'],
        ['AiZynthFinder Retro*', 'aizynthfinder-retro-star'],
        ['azf-r-v4-4-0', 4, 4, 0]
    ),
    model(
        'aizynthfinder-retro-star-high',
        ['AiZynthFinder', 'aizynthfinder-retro'],
        ['AiZynthFinder Retro* (High)', 'aizynthfinder-retro-star-high'],
        ['azf-rh-v4-4-0', 4, 4, 0]
    ),
    model('askcos', ['ASKCOS', 'askcos'], ['ASKCOS', 'askcos'], ['askcos-v2-0-0', 2, 0, 0]),
    model(
        'dms-explorer-XL',
        ['DirectMultiStep', 'directmultistep'],
        ['DMS Explorer XL', 'dms-explorer-xl'],
        ['explorer-xl-v1-1-3', 1, 1, 3]
    ),
    model('retro-star', ['Retro*', 'og-retro'], ['Retro*', 'retro-star'], ['og-r-v0-1-0', 0, 1, 0]),
    model('retro-star-high', ['Retro*', 'og-retro'], ['Retro* (High)', 'retro-star-high'], ['og-rh-v0-1-0', 0, 1, 0]),
    model(
        'synplanner-1.3.2-mcts-rollout',
        ['SynPlanner', 'synplanner'],
        ['SynPlanner MCTS Rollout', 'synplanner-mcts-rollout'],
        ['synp-m-v1-3-2', 1, 3, 2]
    ),
    model(
        'synplanner-1.3.2-mcts-val',
        ['SynPlanner', 'synplanner'],
        ['SynPlanner MCTS Val', 'synplanner-mcts-val'],
        ['synp-mv-v1-3-2', 1, 3, 2]
    ),
    model(
        'synplanner-1.3.2-nmcs',
        ['SynPlanner', 'synplanner'],
        ['SynPlanner NMCS', 'synplanner-nmcs'],
        ['synp-nm-v1-3-2', 1, 3, 2]
    ),
    model(
        'synplanner-eval',
        ['SynPlanner', 'synplanner'],
        ['SynPlanner MCTS Val', 'synplanner-mcts-val'],
        ['synp-v-v1-2-0', 1, 2, 0]
    ),
    model(
        'synplanner-mcts',
        ['SynPlanner', 'synplanner'],
        ['SynPlanner MCTS Rollout', 'synplanner-mcts-rollout'],
        ['synp-m-v1-2-0', 1, 2, 0]
    ),
    model(
        'syntheseus-retro0-local-retro',
        ['Syntheseus', 'syntheseus'],
        ['Syntheseus LocalRetro', 'syntheseus-retro0-local-retro'],
        ['synt-lr-v0-7-0', 0, 7, 0]
    ),
]
