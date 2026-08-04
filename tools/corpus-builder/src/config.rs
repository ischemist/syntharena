#[derive(Clone, Copy, Debug)]
pub struct StockConfig {
    pub name: &'static str,
    pub description: &'static str,
}

#[derive(Clone, Copy, Debug)]
pub struct BenchmarkConfig {
    pub name: &'static str,
    pub stock: &'static str,
    pub series: &'static str,
}

#[derive(Clone, Copy, Debug)]
pub struct ModelConfig {
    pub artifact: &'static str,
    pub algorithm_name: &'static str,
    pub algorithm_slug: &'static str,
    pub family_name: &'static str,
    pub family_slug: &'static str,
    pub instance_slug: &'static str,
    pub version: (i64, i64, i64),
}

pub const STOCKS: [StockConfig; 3] = [
    StockConfig {
        name: "buyables-stock",
        description: "Commercially available compounds curated by the ASKCOS team.",
    },
    StockConfig {
        name: "n5-stock",
        description: "All leaves represented in the PaRoutes n5 evaluation set.",
    },
    StockConfig {
        name: "n1-n5-stock",
        description: "All leaves represented in the PaRoutes n1 and n5 evaluation sets.",
    },
];

pub const BENCHMARKS: [BenchmarkConfig; 6] = [
    BenchmarkConfig {
        name: "mkt-cnv-160",
        stock: "buyables-stock",
        series: "MARKET",
    },
    BenchmarkConfig {
        name: "mkt-lin-500",
        stock: "buyables-stock",
        series: "MARKET",
    },
    BenchmarkConfig {
        name: "ref-cnv-400",
        stock: "n5-stock",
        series: "REFERENCE",
    },
    BenchmarkConfig {
        name: "ref-lin-600",
        stock: "n5-stock",
        series: "REFERENCE",
    },
    BenchmarkConfig {
        name: "ref-lng-84",
        stock: "n1-n5-stock",
        series: "REFERENCE",
    },
    BenchmarkConfig {
        name: "uspto-190",
        stock: "buyables-stock",
        series: "LEGACY",
    },
];

macro_rules! model {
    ($artifact:literal, $algorithm_name:literal, $algorithm_slug:literal, $family_name:literal, $family_slug:literal, $instance:literal, $major:literal, $minor:literal, $patch:literal) => {
        ModelConfig {
            artifact: $artifact,
            algorithm_name: $algorithm_name,
            algorithm_slug: $algorithm_slug,
            family_name: $family_name,
            family_slug: $family_slug,
            instance_slug: $instance,
            version: ($major, $minor, $patch),
        }
    };
}

pub const MODELS: [ModelConfig; 14] = [
    model!(
        "aizynthfinder-mcts",
        "AiZynthFinder",
        "aizynthfinder-retro",
        "AiZynthFinder MCTS",
        "aizynthfinder-mcts",
        "azf-m-v4-4-0",
        4,
        4,
        0
    ),
    model!(
        "aizynthfinder-mcts-high",
        "AiZynthFinder",
        "aizynthfinder-retro",
        "AiZynthFinder MCTS (High)",
        "aizynthfinder-mcts-high",
        "azf-mh-v4-4-0",
        4,
        4,
        0
    ),
    model!(
        "aizynthfinder-retro-star",
        "AiZynthFinder",
        "aizynthfinder-retro",
        "AiZynthFinder Retro*",
        "aizynthfinder-retro-star",
        "azf-r-v4-4-0",
        4,
        4,
        0
    ),
    model!(
        "aizynthfinder-retro-star-high",
        "AiZynthFinder",
        "aizynthfinder-retro",
        "AiZynthFinder Retro* (High)",
        "aizynthfinder-retro-star-high",
        "azf-rh-v4-4-0",
        4,
        4,
        0
    ),
    model!(
        "askcos",
        "ASKCOS",
        "askcos",
        "ASKCOS",
        "askcos",
        "askcos-v2-0-0",
        2,
        0,
        0
    ),
    model!(
        "dms-explorer-XL",
        "DirectMultiStep",
        "directmultistep",
        "DMS Explorer XL",
        "dms-explorer-xl",
        "explorer-xl-v1-1-3",
        1,
        1,
        3
    ),
    model!(
        "retro-star",
        "Retro*",
        "og-retro",
        "Retro*",
        "retro-star",
        "og-r-v0-1-0",
        0,
        1,
        0
    ),
    model!(
        "retro-star-high",
        "Retro*",
        "og-retro",
        "Retro* (High)",
        "retro-star-high",
        "og-rh-v0-1-0",
        0,
        1,
        0
    ),
    model!(
        "synplanner-1.3.2-mcts-rollout",
        "SynPlanner",
        "synplanner",
        "SynPlanner MCTS Rollout",
        "synplanner-mcts-rollout",
        "synp-m-v1-3-2",
        1,
        3,
        2
    ),
    model!(
        "synplanner-1.3.2-mcts-val",
        "SynPlanner",
        "synplanner",
        "SynPlanner MCTS Val",
        "synplanner-mcts-val",
        "synp-mv-v1-3-2",
        1,
        3,
        2
    ),
    model!(
        "synplanner-1.3.2-nmcs",
        "SynPlanner",
        "synplanner",
        "SynPlanner NMCS",
        "synplanner-nmcs",
        "synp-nm-v1-3-2",
        1,
        3,
        2
    ),
    model!(
        "synplanner-eval",
        "SynPlanner",
        "synplanner",
        "SynPlanner MCTS Val",
        "synplanner-mcts-val",
        "synp-v-v1-2-0",
        1,
        2,
        0
    ),
    model!(
        "synplanner-mcts",
        "SynPlanner",
        "synplanner",
        "SynPlanner MCTS Rollout",
        "synplanner-mcts-rollout",
        "synp-m-v1-2-0",
        1,
        2,
        0
    ),
    model!(
        "syntheseus-retro0-local-retro",
        "Syntheseus",
        "syntheseus",
        "Syntheseus LocalRetro",
        "syntheseus-retro0-local-retro",
        "synt-lr-v0-7-0",
        0,
        7,
        0
    ),
];

pub fn benchmark(name: &str) -> Option<&'static BenchmarkConfig> {
    BENCHMARKS.iter().find(|value| value.name == name)
}

pub fn model(name: &str) -> Option<&'static ModelConfig> {
    MODELS.iter().find(|value| value.artifact == name)
}
